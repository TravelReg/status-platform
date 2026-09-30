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