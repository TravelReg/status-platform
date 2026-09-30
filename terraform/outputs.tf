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