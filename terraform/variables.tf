variable "aws_account_id" {
  description = "AWS account where this platform will be deployed"
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must contain exactly 12 digits."
  }
}

variable "aws_region" {
  description = "AWS deployment region"
  type        = string
  default     = "eu-north-1"
}

variable "project_name" {
  description = "Prefix for project resources"
  type        = string
  default     = "status-platform"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "ubuntu_ami_id" {
  description = "Pinned Canonical Ubuntu 24.04 amd64 AMI"
  type        = string
}

variable "k3s_version" {
  description = "Pinned K3s release"

  type = string

  validation {
    condition = can(
      regex("^v[0-9]+\\.[0-9]+\\.[0-9]+\\+k3s[0-9]+$", var.k3s_version)
    )
    error_message = "Use a release version such as v1.36.4+k3s1."
  }
}

variable "github_owner_id" {
  description = "Permanent numeric GitHub organization or owner ID"
  type        = string

  validation {
    condition     = can(regex("^[0-9]+$", var.github_owner_id))
    error_message = "github_owner_id must contain only digits."
  }
}

variable "github_repository_id" {
  description = "Permanent numeric GitHub repository ID"
  type        = string

  validation {
    condition     = can(regex("^[0-9]+$", var.github_repository_id))
    error_message = "github_repository_id must contain only digits."
  }
}