variable "aws_region" {
  description = "Region for the S3 bucket."
  type        = string
  default     = "ap-southeast-2"
}

variable "aws_profile" {
  description = "AWS CLI profile to deploy with (not the root account)."
  type        = string
  default     = null
}

variable "bucket_name" {
  description = "Override for the private site bucket name (defaults to jh-gallery-site-<account id>)."
  type        = string
  default     = null
}

variable "domain_name" {
  description = "Custom domain for the gallery (DNS is on Cloudflare)."
  type        = string
  default     = "gallery.jessamyh.com"
}
