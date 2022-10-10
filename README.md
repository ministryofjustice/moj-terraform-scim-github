# moj-terraform-scim-github

This Terraform module configures a Lambda function for provisioning (and deprovisioning) AWS SSO Identity Store users and groups from GitHub.

The Lambda function used to use the SCIM endpoints (hence its name, _moj-terraform-scim-github_), but now uses the direct [Identity Store API](https://docs.aws.amazon.com/singlesignon/latest/IdentityStoreAPIReference/API_Operations.html). The SCIM API has limitations such as not being able to list more than 50 groups or members (and doesn't support startIndex, so you can't paginate them), whereas the Identity Store API does allow pagination. This allows us to deprovision users and groups using the Identity Store API, which you cannot do easily with the SCIM API.

## Usage
```
module "scim" {
  source                = "github.com/ministryofjustice/moj-terraform-scim-github"
  github_organisation   = "ministryofjustice"
  github_token          = "${github_token}"
  sso_aws_region        = "eu-west-2"
  sso_email_suffix      = "@example.com"
  sso_identity_store_id = "${sso_tenant_id}"
  not_dry_run           = true
}
```

## Inputs
| Name                  | Description                                                                    | Type   | Default | Required |
|-----------------------|--------------------------------------------------------------------------------|--------|---------|----------|
| github_organisation   | GitHub organisation to sync SSO groups and members from                        | string | n/a     | yes      |
| github_token          | GitHub token to perform API calls. Must have the following scopes: read:org    | string | n/a     | yes      |
| sso_aws_region        | Region that AWS SSO is configured in                                           | string | n/a     | yes      |
| sso_email_suffix      | Email suffix to use in AWS SSO                                                 | string | n/a     | yes      |
| sso_identity_store_id | AWS SSO Identity Store ID. Available from the AWS SSO Identity Source settings | string | n/a     | yes      |
| not_dry_run           | Whether this Lambda function is or is _not_ a dry-run                          | string | false   | no       |
| tags                  | Tags to apply to resources, where applicable                                   | map    | {}      | no       |
