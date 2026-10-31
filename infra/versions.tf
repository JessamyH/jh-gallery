terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

# Bucket lives in var.aws_region (Sydney by default).
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = { Project = "jh-gallery" } # lets Cost Explorer show the gallery on its own
  }
}

# CloudFront only accepts ACM certificates from us-east-1.
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile

  default_tags {
    tags = { Project = "jh-gallery" }
  }
}
