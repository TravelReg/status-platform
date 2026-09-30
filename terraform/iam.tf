resource "aws_iam_role" "node" {
  name = "${var.project_name}-${var.environment}-node"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"
        Action = "sts:AssumeRole"

        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "node_runtime" {
  name = "${var.project_name}-${var.environment}-runtime"
  role = aws_iam_role.node.name

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Sid      = "ECRAuthentication"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "PullProjectImages"
        Effect = "Allow"

        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]

        Resource = [
          for component in ["api", "prober", "frontend"] :
          "arn:aws:ecr:${var.aws_region}:${var.aws_account_id}:repository/${var.project_name}-${var.environment}-${component}"
        ]
      },
      {
        Sid    = "AccessProbeTable"
        Effect = "Allow"

        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query"
        ]

        Resource = aws_dynamodb_table.probes.arn
      }
    ]
  })
}

resource "aws_iam_instance_profile" "node" {
  name = "${var.project_name}-${var.environment}-node"
  role = aws_iam_role.node.name
}