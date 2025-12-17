data "aws_caller_identity" "current" {}

# This is used for the Lambda name and CloudWatch Log group, which is automatically created by AWS
# but we can manage it via Terraform if we use the same name
locals {
  name = "aws-sso-scim-github"
}

# KMS alias
data "aws_kms_alias" "lambda" {
  name = "alias/aws/lambda"
}

# IAM role
data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "default" {
  # Allow the function to write logs
  statement {
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]

    resources = ["${aws_cloudwatch_log_group.default.arn}:*"]
  }

  statement {
    effect = "Allow"
    actions = [
      "identitystore:CreateGroup",
      "identitystore:CreateGroupMembership",
      "identitystore:CreateUser",
      "identitystore:DeleteGroup",
      "identitystore:DeleteGroupMembership",
      "identitystore:DeleteUser",
      "identitystore:DescribeGroup",
      "identitystore:DescribeGroupMembership",
      "identitystore:ListGroupMemberships",
      "identitystore:ListGroups",
      "identitystore:ListUsers",
    ]

    resources = [
      "arn:aws:identitystore::${data.aws_caller_identity.current.account_id}:identitystore/${var.sso_identity_store_id}",
      "arn:aws:identitystore:::user/*",
      "arn:aws:identitystore:::group/*",
      "arn:aws:identitystore:::membership/*"
    ]
  }
}

resource "aws_iam_policy" "default" {
  name   = local.name
  policy = data.aws_iam_policy_document.default.json
}

resource "aws_iam_role_policy_attachment" "default" {
  role       = aws_iam_role.default.name
  policy_arn = aws_iam_policy.default.arn
}

resource "aws_iam_role" "default" {
  name               = "aws-sso-scim-github-lambda"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

# CloudWatch Log
#checkov:skip=CKV_AWS_338:30 day retention is sufficient for SCIM sync logs
#checkov:skip=CKV_AWS_158:CloudWatch Logs encryption with KMS not required for this use case
#trivy:ignore:AVD-AWS-0017
resource "aws_cloudwatch_log_group" "default" {
  name              = "/aws/lambda/${local.name}"
  retention_in_days = 30
  tags              = var.tags
}

# EventBridge (previously known as CloudWatch) scheduled event
resource "aws_cloudwatch_event_rule" "default" {
  name                = "run-${local.name}-daily"
  description         = "Scheduled event for ${local.name}"
  schedule_expression = "cron(0 */2 * * ? *)" # Every 2 hours on the hour (00:00, 02:00, 04:00, etc. UTC)
}

resource "aws_cloudwatch_event_target" "default" {
  rule = aws_cloudwatch_event_rule.default.name
  arn  = aws_lambda_function.default.arn
}

# Lambda function
## Build node_modules
data "external" "node_modules" {
  program = ["bash", "-c", <<EOT
  npm ci >&2 && echo "{\"sso_build_destination\": \"function\"}"
EOT
  ]
  working_dir = "${path.module}/function"
}

## ZIP up the function
data "archive_file" "function" {
  type        = "zip"
  output_path = "${path.module}/function.zip"
  source_dir  = "${path.module}/function"
  depends_on  = [data.external.node_modules]
}

## Create the Lambda function
#checkov:skip=CKV_AWS_117:Lambda does not need VPC access for this use case
#checkov:skip=CKV_AWS_116:DLQ not required for scheduled sync operation - CloudWatch alarms provide monitoring
#checkov:skip=CKV_AWS_272:Code signing not implemented for this Lambda function
#checkov:skip=CKV_AWS_115:Concurrent execution limit not required - single scheduled invocation
#checkov:skip=CKV_AWS_50:X-Ray tracing not required - CloudWatch Logs and metrics provide sufficient observability
#trivy:ignore:AVD-AWS-0066
resource "aws_lambda_function" "default" {
  #ts:skip=AC_AWS_0486 No VPC configuration needed for this Lambda function
  #ts:skip=AC_AWS_0485 CloudWatch Logs and metrics provide sufficient observability
  filename         = data.archive_file.function.output_path
  function_name    = local.name
  handler          = "index.handler"
  kms_key_arn      = data.aws_kms_alias.lambda.target_key_arn
  role             = aws_iam_role.default.arn
  runtime          = "nodejs22.x"
  source_code_hash = data.archive_file.function.output_base64sha256
  timeout          = 300
  memory_size      = 512
  architectures    = ["arm64"]

  environment {
    variables = {
      GITHUB_ORGANISATION        = var.github_organisation
      GITHUB_APP_ID              = var.github_app_id
      GITHUB_APP_PRIVATE_KEY     = var.github_app_private_key
      GITHUB_APP_INSTALLATION_ID = var.github_app_installation_id
      SSO_AWS_REGION             = var.sso_aws_region
      SSO_EMAIL_SUFFIX           = var.sso_email_suffix
      SSO_IDENTITY_STORE_ID      = var.sso_identity_store_id
      NOT_DRY_RUN                = var.not_dry_run
    }
  }

  tags = var.tags

  depends_on = [
    data.archive_file.function,
    aws_cloudwatch_log_group.default
  ]
}

## Give CloudWatch permission to run it (via a Scheduled Event)
resource "aws_lambda_permission" "default" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.default.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.default.arn
}

# ========================================
# Monitoring and Alerting Resources
# ========================================

# SNS Topic for Lambda alarms
#trivy:ignore:AVD-AWS-0136
resource "aws_sns_topic" "lambda_alarms" {
  count = var.enable_monitoring && var.alarm_sns_topic_arn == "" ? 1 : 0

  name              = "${local.name}-alarms"
  display_name      = "SCIM Lambda Alerts"
  kms_master_key_id = "alias/aws/sns"

  tags = var.tags
}

# SNS Topic Policy
resource "aws_sns_topic_policy" "lambda_alarms" {
  count = var.enable_monitoring && var.alarm_sns_topic_arn == "" ? 1 : 0

  arn = aws_sns_topic.lambda_alarms[0].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudWatchAlarms"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.lambda_alarms[0].arn
      }
    ]
  })
}

# Email subscriptions for SNS topic
resource "aws_sns_topic_subscription" "email" {
  count = var.enable_monitoring && var.alarm_sns_topic_arn == "" ? length(var.alarm_email_endpoints) : 0

  topic_arn = aws_sns_topic.lambda_alarms[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email_endpoints[count.index]
}

# Local variable for SNS topic ARN (use existing or newly created)
locals {
  sns_topic_arn = var.enable_monitoring ? (
    var.alarm_sns_topic_arn != "" ? var.alarm_sns_topic_arn : try(aws_sns_topic.lambda_alarms[0].arn, "")
  ) : ""
}

# CloudWatch Alarm: Lambda Errors
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  count = var.enable_monitoring && var.enable_error_alarm ? 1 : 0

  alarm_name          = "${local.name}-errors"
  alarm_description   = "Alerts when Lambda function has errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.error_alarm_evaluation_periods
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = var.error_alarm_period
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.default.function_name
  }

  alarm_actions = [local.sns_topic_arn]
  ok_actions    = [local.sns_topic_arn]

  tags = var.tags
}

# CloudWatch Alarm: Lambda Error Rate
resource "aws_cloudwatch_metric_alarm" "lambda_error_rate" {
  count = var.enable_monitoring && var.enable_error_rate_alarm ? 1 : 0

  alarm_name          = "${local.name}-error-rate"
  alarm_description   = "Alerts when Lambda error rate exceeds ${var.error_rate_threshold}%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.error_rate_alarm_evaluation_periods
  threshold           = var.error_rate_threshold
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "(errors / invocations) * 100"
    label       = "Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      metric_name = "Errors"
      namespace   = "AWS/Lambda"
      period      = var.error_rate_alarm_period
      stat        = "Sum"
      dimensions = {
        FunctionName = aws_lambda_function.default.function_name
      }
    }
  }

  metric_query {
    id = "invocations"
    metric {
      metric_name = "Invocations"
      namespace   = "AWS/Lambda"
      period      = var.error_rate_alarm_period
      stat        = "Sum"
      dimensions = {
        FunctionName = aws_lambda_function.default.function_name
      }
    }
  }

  alarm_actions = [local.sns_topic_arn]
  ok_actions    = [local.sns_topic_arn]

  tags = var.tags
}

# CloudWatch Alarm: Lambda Duration
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  count = var.enable_monitoring && var.enable_duration_alarm ? 1 : 0

  alarm_name          = "${local.name}-duration"
  alarm_description   = "Alerts when Lambda duration approaches timeout (${var.duration_threshold_ms}ms)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.duration_alarm_evaluation_periods
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = var.duration_alarm_period
  statistic           = "Maximum"
  threshold           = var.duration_threshold_ms
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.default.function_name
  }

  alarm_actions = [local.sns_topic_arn]
  ok_actions    = [local.sns_topic_arn]

  tags = var.tags
}

# CloudWatch Alarm: Lambda Throttles
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  count = var.enable_monitoring && var.enable_throttle_alarm ? 1 : 0

  alarm_name          = "${local.name}-throttles"
  alarm_description   = "Alerts when Lambda function is throttled"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.throttle_alarm_evaluation_periods
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = var.throttle_alarm_period
  statistic           = "Sum"
  threshold           = var.throttle_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.default.function_name
  }

  alarm_actions = [local.sns_topic_arn]
  ok_actions    = [local.sns_topic_arn]

  tags = var.tags
}

# CloudWatch Alarm: Scheduled Job Failure
resource "aws_cloudwatch_metric_alarm" "scheduled_job_failure" {
  count = var.enable_monitoring && var.enable_scheduled_job_alarm ? 1 : 0

  alarm_name          = "${local.name}-scheduled-failure"
  alarm_description   = "Alerts when scheduled Lambda invocation fails"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = var.scheduled_job_alarm_evaluation_periods
  metric_name         = "FailedInvocations"
  namespace           = "AWS/Events"
  period              = var.scheduled_job_alarm_period
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    RuleName = aws_cloudwatch_event_rule.default.name
  }

  alarm_actions = [local.sns_topic_arn]
  ok_actions    = [local.sns_topic_arn]

  tags = var.tags
}
