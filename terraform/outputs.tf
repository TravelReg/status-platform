output "probe_table_name" {
  description = "DynamoDB table for probe history"
  value       = aws_dynamodb_table.probes.name
}

output "probe_table_arn" {
  description = "DynamoDB table ARN for IAM permissions"
  value       = aws_dynamodb_table.probes.arn
}

output "aws_region" {
  description = "AWS deployment region"
  value       = var.aws_region
}

output "vpc_id" {
  description = "VPC containing the status platform"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "Public subnet for the K3s server"
  value       = aws_subnet.public.id
}

output "public_route_table_id" {
  description = "Route table providing internet access"
  value       = aws_route_table.public.id
}

output "availability_zone" {
  description = "Availability zone containing the public subnet"
  value       = aws_subnet.public.availability_zone
}

output "server_security_group_id" {
  description = "Security group for the K3s server"
  value       = aws_security_group.node.id
}

output "instance_profile_name" {
  description = "IAM instance profile attached to EC2"
  value       = aws_iam_instance_profile.node.name
}

output "node_role_name" {
  description = "IAM role used by the EC2 server"
  value       = aws_iam_role.node.name
}

output "ecr_repository_urls" {
  description = "Private ECR repository URLs for application images"

  value = {
    for component, repository in aws_ecr_repository.apps :
    component => repository.repository_url
  }
}

output "instance_id" {
  description = "EC2 instance running K3s"
  value       = aws_instance.node.id
}

output "server_public_ip" {
  description = "Stable public IPv4 address"
  value       = aws_eip.node.public_ip
}

output "github_actions_role_arn" {
  description = "IAM role assumed by GitHub Actions through OIDC"
  value       = aws_iam_role.github_actions.arn
}