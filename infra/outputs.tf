output "site_url" {
  description = "Public HTTPS address of the gallery."
  value       = "https://${var.domain_name}"
}

output "bucket_name" {
  description = "Private bucket the deploy script syncs to."
  value       = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  description = "Used by the deploy script for cache invalidations."
  value       = aws_cloudfront_distribution.site.id
}

output "acm_validation_records" {
  description = "CNAME records to add in Cloudflare (DNS only) so ACM can validate the certificate."
  value       = aws_acm_certificate.gallery.domain_validation_options
}

output "certificate_arn" {
  description = "ACM certificate (us-east-1) used by CloudFront."
  value       = aws_acm_certificate.gallery.arn
}

output "cloudfront_domain_name" {
  description = "Target for the gallery CNAME in Cloudflare."
  value       = aws_cloudfront_distribution.site.domain_name
}
