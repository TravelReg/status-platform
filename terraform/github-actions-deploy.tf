data "aws_iam_policy_document" "github_actions_deploy" {
  statement {
    sid    = "DiscoverDeploymentNode"
    effect = "Allow"

    actions = [
      "ec2:DescribeInstances"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "SendCommandToK3sNode"
    effect = "Allow"

    actions = [
      "ssm:SendCommand"
    ]

    resources = [
      aws_instance.node.arn,
      "arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript"
    ]
  }

  statement {
    sid    = "ReadCommandResult"
    effect = "Allow"

    actions = [
      "ssm:GetCommandInvocation"
    ]

    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "status-platform-dev-github-actions-deploy"
  role   = aws_iam_role.github_actions.name
  policy = data.aws_iam_policy_document.github_actions_deploy.json
}
