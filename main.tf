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
resource "aws_lambda_function" "default" {
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
