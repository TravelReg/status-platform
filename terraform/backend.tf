terraform {
  backend "s3" {
    bucket       = "status-platform-tfstate-820932217554-eu-north-1"
    key          = "status-platform/dev/terraform.tfstate"
    region       = "eu-north-1"
    encrypt      = true
    use_lockfile = true
  }
}