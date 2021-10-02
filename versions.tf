terraform {
  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = ">=2.2.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = ">=3.6.0"
    }
    external = {
      source  = "hashicorp/external"
      version = ">=2.1.0"
    }
  }
  required_version = ">= 0.15"
}
