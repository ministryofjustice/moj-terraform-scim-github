# moj-terraform-scim-github

[![repo standards badge](https://img.shields.io/endpoint?labelColor=231f20&color=005ea5&style=for-the-badge&label=MoJ%20Compliant&url=https%3A%2F%2Foperations-engineering-reports.cloud-platform.service.justice.gov.uk%2Fapi%2Fv1%2Fcompliant_public_repositories%2Fendpoint%2Fmoj-terraform-scim-github&logo=data:image/png;base64,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)](https://operations-engineering-reports.cloud-platform.service.justice.gov.uk/public-github-repositories.html#moj-terraform-scim-github)

This Terraform module configures a Lambda function for provisioning (and deprovisioning) AWS SSO Identity Store users and groups from GitHub.

The Lambda function used to use the SCIM endpoints (hence its name, _moj-terraform-scim-github_), but now uses the direct [Identity Store API](https://docs.aws.amazon.com/singlesignon/latest/IdentityStoreAPIReference/API_Operations.html). The SCIM API has limitations such as not being able to list more than 50 groups or members (and doesn't support startIndex, so you can't paginate them), whereas the Identity Store API does allow pagination. This allows us to deprovision users and groups using the Identity Store API, which you cannot do easily with the SCIM API.

## Usage

```
module "scim" {
  source                = "github.com/ministryofjustice/moj-terraform-scim-github"
  github_organisation   = "ministryofjustice"
  github_token          = "${var.github_token}"
  sso_aws_region        = "eu-west-2"
  sso_email_suffix      = "@example.com"
  sso_identity_store_id = "${var.sso_tenant_id}"
  not_dry_run           = true
}
```

<!-- BEGIN_TF_DOCS -->

## Requirements

| Name                                                                     | Version  |
| ------------------------------------------------------------------------ | -------- |
| <a name="requirement_terraform"></a> [terraform](#requirement_terraform) | >= 1.0   |
| <a name="requirement_archive"></a> [archive](#requirement_archive)       | >= 2.4.0 |
| <a name="requirement_aws"></a> [aws](#requirement_aws)                   | >= 5.0.0 |
| <a name="requirement_external"></a> [external](#requirement_external)    | >= 2.3.0 |

## Providers

| Name                                                            | Version  |
| --------------------------------------------------------------- | -------- |
| <a name="provider_archive"></a> [archive](#provider_archive)    | >= 2.4.0 |
| <a name="provider_aws"></a> [aws](#provider_aws)                | >= 5.0.0 |
| <a name="provider_external"></a> [external](#provider_external) | >= 2.3.0 |

## Modules

No modules.

## Resources

| Name                                                                                                                                             | Type        |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| [aws_cloudwatch_event_rule.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_event_rule)           | resource    |
| [aws_cloudwatch_event_target.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_event_target)       | resource    |
| [aws_cloudwatch_log_group.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_log_group)             | resource    |
| [aws_iam_policy.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy)                                 | resource    |
| [aws_iam_role.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role)                                     | resource    |
| [aws_iam_role_policy_attachment.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role_policy_attachment) | resource    |
| [aws_lambda_function.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function)                       | resource    |
| [aws_lambda_permission.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_permission)                   | resource    |
| [archive_file.function](https://registry.terraform.io/providers/hashicorp/archive/latest/docs/data-sources/file)                                 | data source |
| [aws_caller_identity.current](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/caller_identity)                    | data source |
| [aws_iam_policy_document.assume-role](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/iam_policy_document)        | data source |
| [aws_iam_policy_document.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/iam_policy_document)            | data source |
| [aws_kms_alias.lambda](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/kms_alias)                                 | data source |
| [external_external.node_modules](https://registry.terraform.io/providers/hashicorp/external/latest/docs/data-sources/external)                   | data source |

## Inputs

| Name                                                                                             | Description                                                                                                    | Type       | Default | Required |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------- | ------- | :------: |
| <a name="input_github_organisation"></a> [github_organisation](#input_github_organisation)       | GitHub organisation to sync SSO groups and members from                                                        | `string`   | n/a     |   yes    |
| <a name="input_github_token"></a> [github_token](#input_github_token)                            | GitHub token to perform API calls. Must have the following scopes: read:org                                    | `string`   | n/a     |   yes    |
| <a name="input_not_dry_run"></a> [not_dry_run](#input_not_dry_run)                               | Whether this is a dry run Lambda or not                                                                        | `string`   | `false` |    no    |
| <a name="input_sso_aws_region"></a> [sso_aws_region](#input_sso_aws_region)                      | Region that AWS SSO is configured in (required for the SCIM URL)                                               | `string`   | n/a     |   yes    |
| <a name="input_sso_email_suffix"></a> [sso_email_suffix](#input_sso_email_suffix)                | Email suffix to use in AWS SSO. It's arbitrary, but may be useful if syncing more than one GitHub organisation | `string`   | n/a     |   yes    |
| <a name="input_sso_identity_store_id"></a> [sso_identity_store_id](#input_sso_identity_store_id) | AWS SSO Identity Store ID. Available from the AWS SSO Identity Source settings                                 | `string`   | n/a     |   yes    |
| <a name="input_tags"></a> [tags](#input_tags)                                                    | Tags to apply to resources, where applicable                                                                   | `map(any)` | `{}`    |    no    |

## Outputs

No outputs.

<!-- END_TF_DOCS -->

## Running the function locally

To run the function locally add the following line to the end of the `index.js` file:

```
(async function() { await module.exports.handler() })()
```

From the function folder, ensure you have the correct version of node installed and run `npm install`.
Set your AWS root account credentials and then run the fuction with:

```
GITHUB_ORGANISATION=ministryofjustice GITHUB_TOKEN=<your token> SSO_AWS_REGION=eu-west-2 SSO_EMAIL_SUFFIX='@digital.justice.gov.uk' SSO_IDENTITY_STORE_ID=<the ID from console> node index.js
```

Replacing with an appropriate GitHub token etc.
