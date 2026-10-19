terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# Bucket and everything else live in Sydney.
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = { Project = "jh-gallery" } # lets Cost Explorer show the gallery on its own
  }
}

# Phase 2 (custom domain) adds a us-east-1 provider for the ACM certificate
# and the Cloudflare provider for DNS. Phase 1 serves on the *.cloudfront.net address.
