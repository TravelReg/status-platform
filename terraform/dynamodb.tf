resource "aws_dynamodb_table" "probes" {
  name         = "${var.project_name}-${var.environment}-probes"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "ServiceID"
  range_key    = "Timestamp"

  attribute {
    name = "ServiceID"
    type = "S"
  }

  attribute {
    name = "Timestamp"
    type = "S"
  }

  ttl {
    attribute_name = "ExpiresAt"
    enabled        = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-probes"
  }
}