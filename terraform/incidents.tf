resource "aws_dynamodb_table" "incidents" {
  name         = "${var.project_name}-${var.environment}-incidents"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "IncidentID"

  attribute {
    name = "IncidentID"
    type = "S"
  }

  attribute {
    name = "Status"
    type = "S"
  }

  attribute {
    name = "CreatedAt"
    type = "S"
  }

  global_secondary_index {
    name            = "StatusCreatedAtIndex"
    hash_key        = "Status"
    range_key       = "CreatedAt"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-incidents"
  }
}

resource "aws_iam_role_policy" "node_incidents" {
  name = "${var.project_name}-${var.environment}-node-incidents"
  role = aws_iam_role.node.name

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Sid    = "AccessIncidentTable"
        Effect = "Allow"

        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]

        Resource = [
          aws_dynamodb_table.incidents.arn,
          "${aws_dynamodb_table.incidents.arn}/index/*"
        ]
      }
    ]
  })
}

output "incident_table_name" {
  description = "DynamoDB table containing status incidents"
  value       = aws_dynamodb_table.incidents.name
}

output "incident_table_arn" {
  description = "ARN of the DynamoDB incident table"
  value       = aws_dynamodb_table.incidents.arn
}
