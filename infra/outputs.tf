output "site_url" {
  description = "Public HTTPS address of the gallery."
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "bucket_name" {
  description = "Private bucket the deploy script syncs to."
  value       = aws_s3_bucket.site.bucket
}

output "distribution_id" {
  description = "Used by the deploy script for cache invalidations."
  value       = aws_cloudfront_distribution.site.id
}
