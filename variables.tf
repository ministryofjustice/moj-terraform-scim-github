variable "github_organisation" {
  type        = string
  description = "GitHub organisation to sync SSO groups and members from"
}

variable "github_token" {
  type        = string
  description = "GitHub token to perform API calls. Must have the following scopes: read:org"
  sensitive   = true
}

variable "enable_aad_sync" {
  type        = bool
  description = "Set to true to sync AAD groups and users"
  default     = false
}
variable "azure_application_id" {
  type        = string
  description = "AzureAD application to retrieve users and groups. Must Have the following permissions: Group.Read.All, User.Read"
  sensitive   = true
  default     = null
}

variable "azure_application_secret" {
  type        = string
  description = "AzureAD application secret to retrieve users and groups"
  sensitive   = true
  default     = null
}

variable "azure_tenant_id" {
  type        = string
  description = "AzureAD tenant to retrieve users and groups"
  sensitive   = true
  default     = null
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
