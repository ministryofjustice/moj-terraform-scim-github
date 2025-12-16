# moj-terraform-scim-github

[![Ministry of Justice Repository Compliance Badge](https://github-community.service.justice.gov.uk/repository-standards/api/moj-terraform-scim-github/badge)](https://github-community.service.justice.gov.uk/repository-standards/moj-terraform-scim-github)

[![Open in Dev Container](https://raw.githubusercontent.com/ministryofjustice/.devcontainer/refs/heads/main/contrib/badge.svg)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/ministryofjustice/moj-terraform-scim-github)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/ministryofjustice/moj-terraform-scim-github)

This Terraform module configures a Lambda function for provisioning (and deprovisioning) AWS IAM Identity Centre users and groups from GitHub.

The Lambda function used to use the SCIM endpoints (hence its name, _moj-terraform-scim-github_), but now uses the direct [Identity Store API](https://docs.aws.amazon.com/singlesignon/latest/IdentityStoreAPIReference/API_Operations.html). The SCIM API has limitations such as not being able to list more than 50 groups or members (and doesn't support startIndex, so you can't paginate them), whereas the Identity Store API does allow pagination. This allows us to deprovision users and groups using the Identity Store API, which you cannot do easily with the SCIM API.

## Usage

### Basic Usage

```hcl
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

### With Monitoring

```hcl
module "scim" {
  source                = "github.com/ministryofjustice/moj-terraform-scim-github"
  github_organisation   = "ministryofjustice"
  github_token          = "${var.github_token}"
  sso_aws_region        = "eu-west-2"
  sso_email_suffix      = "@example.com"
  sso_identity_store_id = "${var.sso_tenant_id}"
  not_dry_run           = true

  # Enable monitoring with email alerts
  enable_monitoring     = true
  alarm_email_endpoints = ["team@example.com"]
}
```

See [MONITORING.md](MONITORING.md) for comprehensive monitoring documentation.

<!-- markdownlint-disable MD013 MD034 MD060 -->
<!-- BEGIN_TF_DOCS -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_terraform"></a> [terraform](#requirement\_terraform) | >= 1.0 |
| <a name="requirement_archive"></a> [archive](#requirement\_archive) | >= 2.4.0 |
| <a name="requirement_aws"></a> [aws](#requirement\_aws) | >= 5.0.0 |
| <a name="requirement_external"></a> [external](#requirement\_external) | >= 2.3.0 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_archive"></a> [archive](#provider\_archive) | >= 2.4.0 |
| <a name="provider_aws"></a> [aws](#provider\_aws) | >= 5.0.0 |
| <a name="provider_external"></a> [external](#provider\_external) | >= 2.3.0 |

## Modules

No modules.

## Resources

| Name | Type |
|------|------|
| [aws_cloudwatch_event_rule.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_event_rule) | resource |
| [aws_cloudwatch_event_target.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_event_target) | resource |
| [aws_cloudwatch_log_group.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_log_group) | resource |
| [aws_cloudwatch_metric_alarm.lambda_duration](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_metric_alarm) | resource |
| [aws_cloudwatch_metric_alarm.lambda_error_rate](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_metric_alarm) | resource |
| [aws_cloudwatch_metric_alarm.lambda_errors](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_metric_alarm) | resource |
| [aws_cloudwatch_metric_alarm.lambda_throttles](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_metric_alarm) | resource |
| [aws_cloudwatch_metric_alarm.scheduled_job_failure](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_metric_alarm) | resource |
| [aws_iam_policy.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy) | resource |
| [aws_iam_role.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role) | resource |
| [aws_iam_role_policy_attachment.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role_policy_attachment) | resource |
| [aws_lambda_function.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function) | resource |
| [aws_lambda_permission.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_permission) | resource |
| [aws_sns_topic.lambda_alarms](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/sns_topic) | resource |
| [aws_sns_topic_policy.lambda_alarms](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/sns_topic_policy) | resource |
| [aws_sns_topic_subscription.email](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/sns_topic_subscription) | resource |
| [archive_file.function](https://registry.terraform.io/providers/hashicorp/archive/latest/docs/data-sources/file) | data source |
| [aws_caller_identity.current](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/caller_identity) | data source |
| [aws_iam_policy_document.assume_role](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/iam_policy_document) | data source |
| [aws_iam_policy_document.default](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/iam_policy_document) | data source |
| [aws_kms_alias.lambda](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/kms_alias) | data source |
| [external_external.node_modules](https://registry.terraform.io/providers/hashicorp/external/latest/docs/data-sources/external) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_alarm_email_endpoints"></a> [alarm\_email\_endpoints](#input\_alarm\_email\_endpoints) | List of email addresses to receive alarm notifications | `list(string)` | `[]` | no |
| <a name="input_alarm_sns_topic_arn"></a> [alarm\_sns\_topic\_arn](#input\_alarm\_sns\_topic\_arn) | Existing SNS topic ARN for alarm notifications. If not provided and enable\_monitoring is true, a new topic will be created. | `string` | `""` | no |
| <a name="input_duration_alarm_evaluation_periods"></a> [duration\_alarm\_evaluation\_periods](#input\_duration\_alarm\_evaluation\_periods) | Number of periods over which to evaluate the duration alarm | `number` | `1` | no |
| <a name="input_duration_alarm_period"></a> [duration\_alarm\_period](#input\_duration\_alarm\_period) | Period in seconds for duration alarm evaluation | `number` | `300` | no |
| <a name="input_duration_threshold_ms"></a> [duration\_threshold\_ms](#input\_duration\_threshold\_ms) | Lambda duration in milliseconds that triggers an alarm | `number` | `270000` | no |
| <a name="input_enable_duration_alarm"></a> [enable\_duration\_alarm](#input\_enable\_duration\_alarm) | Enable CloudWatch alarm for Lambda duration | `bool` | `true` | no |
| <a name="input_enable_error_alarm"></a> [enable\_error\_alarm](#input\_enable\_error\_alarm) | Enable CloudWatch alarm for Lambda errors | `bool` | `true` | no |
| <a name="input_enable_error_rate_alarm"></a> [enable\_error\_rate\_alarm](#input\_enable\_error\_rate\_alarm) | Enable CloudWatch alarm for Lambda error rate | `bool` | `true` | no |
| <a name="input_enable_monitoring"></a> [enable\_monitoring](#input\_enable\_monitoring) | Enable CloudWatch alarms and monitoring for the Lambda function | `bool` | `false` | no |
| <a name="input_enable_scheduled_job_alarm"></a> [enable\_scheduled\_job\_alarm](#input\_enable\_scheduled\_job\_alarm) | Enable CloudWatch alarm for scheduled job failures | `bool` | `true` | no |
| <a name="input_enable_throttle_alarm"></a> [enable\_throttle\_alarm](#input\_enable\_throttle\_alarm) | Enable CloudWatch alarm for Lambda throttles | `bool` | `true` | no |
| <a name="input_error_alarm_evaluation_periods"></a> [error\_alarm\_evaluation\_periods](#input\_error\_alarm\_evaluation\_periods) | Number of periods over which to evaluate the error alarm | `number` | `1` | no |
| <a name="input_error_alarm_period"></a> [error\_alarm\_period](#input\_error\_alarm\_period) | Period in seconds for error alarm evaluation | `number` | `300` | no |
| <a name="input_error_rate_alarm_evaluation_periods"></a> [error\_rate\_alarm\_evaluation\_periods](#input\_error\_rate\_alarm\_evaluation\_periods) | Number of periods over which to evaluate the error rate alarm | `number` | `2` | no |
| <a name="input_error_rate_alarm_period"></a> [error\_rate\_alarm\_period](#input\_error\_rate\_alarm\_period) | Period in seconds for error rate alarm evaluation | `number` | `300` | no |
| <a name="input_error_rate_threshold"></a> [error\_rate\_threshold](#input\_error\_rate\_threshold) | Percentage of errors that triggers an alarm (0-100) | `number` | `5` | no |
| <a name="input_github_app_id"></a> [github\_app\_id](#input\_github\_app\_id) | GitHub App ID for authentication | `string` | n/a | yes |
| <a name="input_github_app_installation_id"></a> [github\_app\_installation\_id](#input\_github\_app\_installation\_id) | GitHub App installation ID for the organization | `string` | n/a | yes |
| <a name="input_github_app_private_key"></a> [github\_app\_private\_key](#input\_github\_app\_private\_key) | GitHub App private key in PEM format for authentication | `string` | n/a | yes |
| <a name="input_github_organisation"></a> [github\_organisation](#input\_github\_organisation) | GitHub organisation to sync SSO groups and members from | `string` | n/a | yes |
| <a name="input_not_dry_run"></a> [not\_dry\_run](#input\_not\_dry\_run) | Whether this is a dry run Lambda or not | `string` | `false` | no |
| <a name="input_scheduled_job_alarm_evaluation_periods"></a> [scheduled\_job\_alarm\_evaluation\_periods](#input\_scheduled\_job\_alarm\_evaluation\_periods) | Number of periods over which to evaluate the scheduled job alarm | `number` | `1` | no |
| <a name="input_scheduled_job_alarm_period"></a> [scheduled\_job\_alarm\_period](#input\_scheduled\_job\_alarm\_period) | Period in seconds for scheduled job alarm evaluation (should match or exceed schedule interval) | `number` | `7200` | no |
| <a name="input_sso_aws_region"></a> [sso\_aws\_region](#input\_sso\_aws\_region) | Region that AWS SSO is configured in (required for the SCIM URL) | `string` | n/a | yes |
| <a name="input_sso_email_suffix"></a> [sso\_email\_suffix](#input\_sso\_email\_suffix) | Email suffix to use in AWS SSO. It's arbitrary, but may be useful if syncing more than one GitHub organisation | `string` | n/a | yes |
| <a name="input_sso_identity_store_id"></a> [sso\_identity\_store\_id](#input\_sso\_identity\_store\_id) | AWS SSO Identity Store ID. Available from the AWS SSO Identity Source settings | `string` | n/a | yes |
| <a name="input_tags"></a> [tags](#input\_tags) | Tags to apply to resources, where applicable | `map(any)` | `{}` | no |
| <a name="input_throttle_alarm_evaluation_periods"></a> [throttle\_alarm\_evaluation\_periods](#input\_throttle\_alarm\_evaluation\_periods) | Number of periods over which to evaluate the throttle alarm | `number` | `1` | no |
| <a name="input_throttle_alarm_period"></a> [throttle\_alarm\_period](#input\_throttle\_alarm\_period) | Period in seconds for throttle alarm evaluation | `number` | `300` | no |
| <a name="input_throttle_threshold"></a> [throttle\_threshold](#input\_throttle\_threshold) | Number of throttled invocations that triggers an alarm | `number` | `1` | no |

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_alarm_names"></a> [alarm\_names](#output\_alarm\_names) | Names of all CloudWatch alarms created for monitoring |
| <a name="output_cloudwatch_log_group_name"></a> [cloudwatch\_log\_group\_name](#output\_cloudwatch\_log\_group\_name) | Name of the CloudWatch log group for the Lambda function |
| <a name="output_lambda_function_arn"></a> [lambda\_function\_arn](#output\_lambda\_function\_arn) | ARN of the deployed Lambda function |
| <a name="output_lambda_function_name"></a> [lambda\_function\_name](#output\_lambda\_function\_name) | Name of the deployed Lambda function |
| <a name="output_sns_topic_arn"></a> [sns\_topic\_arn](#output\_sns\_topic\_arn) | ARN of the SNS topic for Lambda alarms (if monitoring is enabled) |
<!-- END_TF_DOCS -->
<!-- markdownlint-enable MD013 MD034 MD060 -->

## Running the function locally

To run the function locally add the following line to the end of the `index.js` file:

```javascript
(async function () {
  await module.exports.handler();
})();
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

### Log in to GitHub

```bash
gh auth login --web --skip-ssh-key --git-protocol ssh
```

### Run function

```bash
NOT_DRY_RUN="false" GITHUB_ORGANISATION="ministryofjustice" GITHUB_TOKEN=$(gh auth token) SSO_AWS_REGION="eu-west-2" SSO_EMAIL_SUFFIX="@digital.justice.gov.uk" SSO_IDENTITY_STORE_ID="$(aws sso-admin list-instances | jq -r '.Instances[].IdentityStoreId')" node index.js
```
