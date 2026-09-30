resource "aws_ecr_repository" "apps" {
  for_each = toset(["api", "prober", "frontend"])

  name                 = "${var.project_name}-${var.environment}-${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name      = "${var.project_name}-${var.environment}-${each.key}"
    Component = each.key
  }
}

resource "aws_ecr_lifecycle_policy" "untagged_cleanup" {
  for_each = aws_ecr_repository.apps

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images older than seven days"

        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }

        action = {
          type = "expire"
        }
      }
    ]
  })
}