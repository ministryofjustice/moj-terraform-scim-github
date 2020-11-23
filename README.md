# moj-terraform-scim-github

This Terraform module to configure a Lambda for SCIM provisioning from GitHub, syncing GitHub to AWS SSO.

## Usage
```
module "scim" {
  source              = "github.com/ministryofjustice/moj-terraform-scim-github"
  github_organisation = "ministryofjustice"
  github_token        = "${github_token}"
  sso_aws_region      = "eu-west-2"
  sso_email_suffix    = "@example.com"
  sso_scim_token      = "${scim_token}"
  sso_tenant_id       = "${sso_tenant_id}"
}
```

## Inputs
| Name                | Description                                                                 | Type   | Default | Required |
|---------------------|-----------------------------------------------------------------------------|--------|---------|----------|
| github_organisation | GitHub organisation to sync SSO groups and members from                     | string | n/a     | yes      |
| github_token        | GitHub token to perform API calls. Must have the following scopes: read:org | string | n/a     | yes      |
| sso_aws_region      | Region that AWS SSO is configured in                                        | string | n/a     | yes      |
| sso_email_suffix    | Email suffix to use in AWS SSO                                              | string | n/a     | yes      |
| sso_scim_token      | AWS SSO SCIM token                                                          | string | n/a     | yes      |
| sso_tenant_id       | AWS SSO tenant ID                                                           | string | n/a     | yes      |
| tags                | Tags to apply to resources, where applicable                                | map    | {}      | no       |
