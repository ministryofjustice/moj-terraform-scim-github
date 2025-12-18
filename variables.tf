variable "github_organisation" {
  type        = string
  description = "GitHub organisation to sync SSO groups and members from"
}

variable "github_app_id" {
  type        = string
  description = "GitHub App ID for authentication"
  sensitive   = true
}

variable "github_app_private_key" {
  type        = string
  description = "GitHub App private key in PEM format for authentication"
  sensitive   = true
}

variable "github_app_installation_id" {
  type        = string
  description = "GitHub App installation ID for the organization"
  sensitive   = true
}

variable "sso_aws_region" {
  type        = string
  description = "Region that AWS SSO is configured in (required for the SCIM URL)"
}

variable "sso_email_suffix" {
  type        = string
  description = "Email suffix to use in AWS SSO. It's arbitrary, but may be useful if syncing more than one GitHub organisation"
}

variable "sso_identity_store_id" {
  type        = string
  description = "AWS SSO Identity Store ID. Available from the AWS SSO Identity Source settings"
  sensitive   = true
}

variable "not_dry_run" {
  type        = string
  description = "Whether this is a dry run Lambda or not"
  default     = false
}

variable "tags" {
  type        = map(any)
  description = "Tags to apply to resources, where applicable"
  default     = {}
}

variable "enable_monitoring" {
  type        = bool
  description = "Enable CloudWatch alarms and monitoring for the Lambda function"
  default     = false
}

variable "alarm_email_endpoints" {
  type        = list(string)
  description = "List of email addresses to receive alarm notifications"
  default     = []
}

variable "alarm_sns_topic_arn" {
  type        = string
  description = "Existing SNS topic ARN for alarm notifications. If not provided and enable_monitoring is true, a new topic will be created."
  default     = ""
}

variable "error_rate_threshold" {
  type        = number
  description = "Percentage of errors that triggers an alarm (0-100)"
  default     = 5
}

variable "duration_threshold_ms" {
  type        = number
  description = "Lambda duration in milliseconds that triggers an alarm"
  default     = 270000 # 4.5 minutes (90% of 5 minute timeout)
}

variable "throttle_threshold" {
  type        = number
  description = "Number of throttled invocations that triggers an alarm"
  default     = 1
}

# Individual alarm enable/disable flags
variable "enable_error_alarm" {
  type        = bool
  description = "Enable CloudWatch alarm for Lambda errors"
  default     = true
}

variable "enable_error_rate_alarm" {
  type        = bool
  description = "Enable CloudWatch alarm for Lambda error rate"
  default     = true
}

variable "enable_duration_alarm" {
  type        = bool
  description = "Enable CloudWatch alarm for Lambda duration"
  default     = true
}

variable "enable_throttle_alarm" {
  type        = bool
  description = "Enable CloudWatch alarm for Lambda throttles"
  default     = true
}

variable "enable_scheduled_job_alarm" {
  type        = bool
  description = "Enable CloudWatch alarm for scheduled job failures"
  default     = true
}

# Alarm evaluation period configuration
variable "error_alarm_evaluation_periods" {
  type        = number
  description = "Number of periods over which to evaluate the error alarm"
  default     = 1
}

variable "error_rate_alarm_evaluation_periods" {
  type        = number
  description = "Number of periods over which to evaluate the error rate alarm"
  default     = 2
}

variable "duration_alarm_evaluation_periods" {
  type        = number
  description = "Number of periods over which to evaluate the duration alarm"
  default     = 1
}

variable "throttle_alarm_evaluation_periods" {
  type        = number
  description = "Number of periods over which to evaluate the throttle alarm"
  default     = 1
}

variable "scheduled_job_alarm_evaluation_periods" {
  type        = number
  description = "Number of periods over which to evaluate the scheduled job alarm"
  default     = 1
}

# Alarm period configuration (in seconds)
variable "error_alarm_period" {
  type        = number
  description = "Period in seconds for error alarm evaluation"
  default     = 300
}

variable "error_rate_alarm_period" {
  type        = number
  description = "Period in seconds for error rate alarm evaluation"
  default     = 300
}

variable "duration_alarm_period" {
  type        = number
  description = "Period in seconds for duration alarm evaluation"
  default     = 300
}

variable "throttle_alarm_period" {
  type        = number
  description = "Period in seconds for throttle alarm evaluation"
  default     = 300
}

variable "scheduled_job_alarm_period" {
  type        = number
  description = "Period in seconds for scheduled job alarm evaluation (should match or exceed schedule interval)"
  default     = 7200
}
