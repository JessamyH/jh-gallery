# Infrastructure

Hosting for JH Gallery: a private S3 bucket served only through CloudFront
(Origin Access Control), at https://gallery.jessamyh.com.

The custom domain uses an ACM certificate in us-east-1 (CloudFront requires it).
DNS is on Cloudflare and managed by hand, as two CNAMEs set to DNS only (not proxied):

- `gallery` → the `cloudfront_domain_name` output
- the ACM validation record from the `acm_validation_records` output. Keep it, or the
  certificate can't renew automatically.

## Usage

```
cd infra
printf 'aws_profile = "jessamy-lab"\n' > terraform.tfvars   # once; git-ignored
terraform init
terraform plan -out=v1.tfplan
terraform apply v1.tfplan
terraform output site_url
```

## State

State is local (`infra/terraform.tfstate`, git-ignored). There's no remote backend
or CI on purpose, to keep V1 small. The state holds resource IDs and ARNs but no
credentials. If it's lost, the resources can be brought back under Terraform with
`terraform import`.

Back it up after every `apply`, to somewhere encrypted and off this laptop, such as
a password manager or an encrypted drive:

```
cp terraform.tfstate "<encrypted backup folder>/jh-gallery-$(date +%F).tfstate"
```

Terraform also keeps the previous version beside it as `terraform.tfstate.backup`.
