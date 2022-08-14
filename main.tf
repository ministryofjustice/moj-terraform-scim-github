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
data "aws_iam_policy_document" "assume-role" {
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
  assume_role_policy = data.aws_iam_policy_document.assume-role.json
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
  schedule_expression = "cron(0 6 * * ? *)"
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
  runtime          = "nodejs14.x"
  source_code_hash = data.archive_file.function.output_base64sha256
  timeout          = 300
  environment {
    variables = {
      GITHUB_ORGANISATION = var.github_organisation
      GITHUB_TOKEN        = var.github_token
      SSO_AWS_REGION      = var.sso_aws_region
      SSO_EMAIL_SUFFIX    = var.sso_email_suffix
      SSO_SCIM_TOKEN      = var.sso_scim_token
      SSO_TENANT_ID       = var.sso_tenant_id
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
