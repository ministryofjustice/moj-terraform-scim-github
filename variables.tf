variable "github_organisation" {
  type        = string
  description = "GitHub organisation to sync SSO groups and members from"
}

variable "github_token" {
  type        = string
  description = "GitHub token to perform API calls. Must have the following scopes: read:org"
}

variable "sso_aws_region" {
  type        = string
  description = "Region that AWS SSO is configured in (required for the SCIM URL)"
}

variable "sso_email_suffix" {
  type        = string
  description = "Email suffix to use in AWS SSO. It's arbitrary, but may be useful if syncing more than one GitHub organisation"
}

variable "sso_scim_token" {
  type        = string
  description = "AWS SSO SCIM token. Generated and shown only once when you turn on AWS SSO automatic SCIM provisioning"
}

variable "sso_tenant_id" {
  type        = string
  description = "AWS SSO tenant ID. Available from the Automatic provisioning section in AWS SSO"
}

variable "tags" {
  type        = map(any)
  description = "Tags to apply to resources, where applicable"
  default     = {}
}
