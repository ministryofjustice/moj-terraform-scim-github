# moj-terraform-scim-github

[![Ministry of Justice Repository Compliance Badge](https://github-community.service.justice.gov.uk/repository-standards/api/moj-terraform-scim-github/badge)](https://github-community.service.justice.gov.uk/repository-standards/moj-terraform-scim-github)

[![Open in Dev Container](https://raw.githubusercontent.com/ministryofjustice/.devcontainer/refs/heads/main/contrib/badge.svg)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/ministryofjustice/moj-terraform-scim-github)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/ministryofjustice/moj-terraform-scim-github)

This Terraform module configures a Lambda function for provisioning (and deprovisioning) AWS IAM Identity Centre users and groups from GitHub.

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

```javascript
(async function() { await module.exports.handler() })()
```

From the [function folder](./function/), ensure you have the correct version of node installed and run `npm install`.
Set your AWS root account credentials and then run the fuction with:

```bash
GITHUB_ORGANISATION=ministryofjustice GITHUB_TOKEN="your token" SSO_AWS_REGION=eu-west-2 SSO_EMAIL_SUFFIX='@digital.justice.gov.uk' SSO_IDENTITY_STORE_ID="<the ID from console" node index.js
```

Replacing with an appropriate GitHub token etc.

## Running the function from the dev container

Additionally a dev container is provided with the required tooling and set up

### Log in to AWS

> [!NOTE]
> This command may take a while to run the first time you use it

```bash
aws-sso login

aws-sso exec --profile MOJMaster:AdministratorAccess
```

### Log in to Github

```bash
gh auth login --web --skip-ssh-key --git-protocol ssh
```

### Run function

```bash
NOT_DRY_RUN="false" GITHUB_ORGANISATION="ministryofjustice" GITHUB_TOKEN=$(gh auth token) SSO_AWS_REGION="eu-west-2" SSO_EMAIL_SUFFIX="@digital.justice.gov.uk" SSO_IDENTITY_STORE_ID="$(aws sso-admin list-instances | jq -r '.Instances[].IdentityStoreId')" node index.js
```