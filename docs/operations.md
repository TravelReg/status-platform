# Status Platform Operations Runbook

## Production environment

- AWS region: `eu-north-1`
- Kubernetes: single-node K3s
- Public domain: `status.travelregger.com`
- DNS: Cloudflare in DNS-only mode
- Server access: AWS Systems Manager Session Manager
- Public ports: TCP 80 and 443
- Persistent data: Amazon DynamoDB
- Container images: Amazon ECR

## Public health checks

Run these commands from the administration computer:

```bash
curl -sS -o /dev/null \
  -w 'HTTP: %{http_code} -> %{redirect_url}\n' \
  http://status.travelregger.com

curl -sS -o /dev/null \
  -w 'HTTPS: %{http_code}\n' \
  https://status.travelregger.com

curl -fsS https://status.travelregger.com/api/health
echo

curl -fsS https://status.travelregger.com/api/services
echo
```

Expected results:

- HTTP redirects to HTTPS.
- The HTTPS dashboard returns HTTP 200.
- `/api/health` returns JSON with `status` set to `ok`.
- `/api/services` returns the monitored services and their current states.

## Connect to the K3s server

Find the running instance from the administration computer:

```bash
STATUS_INSTANCE_ID=$(aws ec2 describe-instances \
  --region eu-north-1 \
  --filters \
    "Name=tag:Name,Values=status-platform-dev-node" \
    "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text)

printf '%s\n' "$STATUS_INSTANCE_ID"
```

Start an SSM session:

```bash
aws ssm start-session \
  --region eu-north-1 \
  --target "$STATUS_INSTANCE_ID"
```

Exit the SSM session when finished:

```bash
exit
```

## Inspect Kubernetes

Run these commands inside the EC2 SSM session:

```bash
sudo k3s kubectl get nodes -o wide
sudo k3s kubectl get deployments --all-namespaces
sudo k3s kubectl get pods --all-namespaces
sudo k3s kubectl get services --all-namespaces
sudo k3s kubectl get ingress --all-namespaces
sudo k3s kubectl get certificate --all-namespaces
sudo k3s kubectl get clusterissuer
```

All application deployments should report their desired replicas as available. Application pods should normally show `Running`.

## Application logs

API logs:

```bash
sudo k3s kubectl logs \
  --namespace status-platform \
  deployment/status-api \
  --tail=100
```

Prober logs:

```bash
sudo k3s kubectl logs \
  --namespace status-platform \
  deployment/status-prober \
  --tail=100
```

Frontend logs:

```bash
sudo k3s kubectl logs \
  --namespace status-platform \
  deployment/status-frontend \
  --tail=100
```

Follow live logs by adding `--follow`:

```bash
sudo k3s kubectl logs \
  --namespace status-platform \
  deployment/status-prober \
  --follow
```

Press `Control-C` to stop following logs.

## GitHub Actions

List recent workflow runs:

```bash
gh run list --limit 20
```

View a specific run:

```bash
gh run view RUN_ID
```

View only failed logs:

```bash
gh run view RUN_ID --log-failed
```

Watch an active run:

```bash
gh run watch RUN_ID --exit-status
```

Replace `RUN_ID` with the numeric ID displayed by `gh run list`.

## Automatic deployments

Application changes follow these deployment paths:

| Component | Build workflow | Deployment workflow |
|---|---|---|
| API | API image | Deploy API |
| Prober | Prober image | Deploy prober |
| Frontend | Frontend image | Deploy frontend |
| TLS and ingress | Not required | Deploy platform configuration |

A successful image workflow automatically triggers the corresponding deployment workflow.

Deployment workflows:

1. Authenticate to AWS using GitHub OpenID Connect.
2. Verify that the immutable image tag exists in ECR.
3. Find the running EC2 instance by its `Name` tag.
4. Submit a deployment command through Systems Manager.
5. Apply the Kubernetes manifest.
6. Wait for the Kubernetes rollout to complete.
7. Fail the workflow if the SSM command or rollout fails.

## Manual deployments

Run the platform configuration workflow:

```bash
gh workflow run deploy-platform.yml --ref main
```

Build and deploy the API:

```bash
gh workflow run api-image.yml --ref main
```

Build and deploy the prober:

```bash
gh workflow run prober-image.yml --ref main
```

Build and deploy the frontend:

```bash
gh workflow run frontend-image.yml --ref main
```

Check the resulting workflows:

```bash
gh run list --limit 20
```

The API, prober, and frontend deployment workflows start automatically after their image workflows succeed.

## Kubernetes secrets

The namespace contains these application secrets:

- `probe-auth` authenticates probe submissions.
- `admin-auth` authenticates incident-management requests.
- `ecr-pull` allows Kubernetes to pull private images from ECR.
- `status-platform-tls` contains the certificate issued by Let’s Encrypt.

Confirm that the secrets exist without displaying their values:

```bash
sudo k3s kubectl get secret \
  probe-auth \
  admin-auth \
  ecr-pull \
  status-platform-tls \
  --namespace status-platform
```

Do not place decoded secret values in:

- Git
- Documentation
- Screenshots
- Shell history
- GitHub Actions logs
- Issue descriptions

The `ecr-pull` secret contains a temporary ECR authorization token. Application deployment scripts refresh it during deployments.

## Certificate inspection

Check the certificate:

```bash
sudo k3s kubectl get certificate status-platform-tls \
  --namespace status-platform
```

The expected state is:

```text
READY   True
```

Inspect all certificate-related resources:

```bash
sudo k3s kubectl get \
  certificate,certificaterequest,order,challenge \
  --namespace status-platform
```

Inspect certificate details:

```bash
sudo k3s kubectl describe certificate status-platform-tls \
  --namespace status-platform
```

Inspect cert-manager logs:

```bash
sudo k3s kubectl logs \
  --namespace cert-manager \
  deployment/cert-manager \
  --tail=100
```

For HTTP-01 validation:

- `status.travelregger.com` must resolve to the EC2 Elastic IP.
- The Cloudflare record should remain in DNS-only mode.
- TCP port 80 must remain publicly accessible for validation and renewal.
- TCP port 443 must remain publicly accessible for the dashboard.

## Pod troubleshooting

List all pods:

```bash
sudo k3s kubectl get pods --all-namespaces
```

Describe a specific pod:

```bash
sudo k3s kubectl describe pod POD_NAME \
  --namespace NAMESPACE
```

Show its current logs:

```bash
sudo k3s kubectl logs POD_NAME \
  --namespace NAMESPACE \
  --tail=100
```

Show logs from the previous failed container:

```bash
sudo k3s kubectl logs POD_NAME \
  --namespace NAMESPACE \
  --previous \
  --tail=100
```

Replace `POD_NAME` and `NAMESPACE` with real values.

## Image-pull troubleshooting

If a pod reports `ImagePullBackOff` or `ErrImagePull`, verify:

1. The expected image tag exists in ECR.
2. The EC2 instance role has permission to read ECR.
3. The `ecr-pull` secret exists in the `status-platform` namespace.
4. The Kubernetes deployment references the correct repository and image tag.
5. The ECR authorization token has been refreshed by a recent deployment.

Inspect the affected pod:

```bash
sudo k3s kubectl describe pod POD_NAME \
  --namespace status-platform
```

Inspect the image used by a deployment:

```bash
sudo k3s kubectl get deployment status-api \
  --namespace status-platform \
  --output jsonpath='{.spec.template.spec.containers[0].image}'

echo
```

Replace `status-api` with `status-prober` or `status-frontend` when checking another component.

## Probe troubleshooting

Check recent prober output:

```bash
sudo k3s kubectl logs \
  --namespace status-platform \
  deployment/status-prober \
  --tail=50
```

Check the API service from inside the cluster:

```bash
API_SERVICE_IP=$(sudo k3s kubectl get service status-api \
  --namespace status-platform \
  --output jsonpath='{.spec.clusterIP}')

curl --fail \
  --silent \
  --show-error \
  "http://${API_SERVICE_IP}/api/health"

echo
```

Check public probe history:

```bash
curl -fsS \
  "https://status.travelregger.com/api/services/example-site/history?limit=5"

echo
```

## EC2 replacement recovery

Use this procedure when Terraform replaces only the EC2 instance while preserving the Elastic IP, ECR repositories, and DynamoDB tables.

1. Wait for the EC2 instance to enter the running state.
2. Wait for the SSM agent to become available.
3. Enter the instance through Session Manager.
4. Run `sudo cloud-init status --wait`.
5. Confirm that the K3s node reports `Ready`.
6. Run the platform-configuration workflow.
7. Build and deploy the API.
8. Build and deploy the prober.
9. Build and deploy the frontend.
10. Verify HTTPS, API health, dashboard access, and probe history.

Check cloud-init:

```bash
sudo cloud-init status --wait
```

Check K3s:

```bash
sudo systemctl is-active k3s
sudo k3s kubectl get nodes
```

If Terraform replaced only the EC2 association, the Elastic IP should remain unchanged and Cloudflare should not require an update.

## Full infrastructure rebuild

Run from the administration computer:

```bash
terraform -chdir=terraform init
terraform -chdir=terraform validate
terraform -chdir=terraform plan
terraform -chdir=terraform apply
```

After Terraform finishes:

1. Record the new instance ID.
2. Record the Elastic IP.
3. Update the Cloudflare A record if the Elastic IP changed.
4. Keep the Cloudflare record in DNS-only mode.
5. Wait for SSM and cloud-init.
6. Confirm that the K3s node is Ready.
7. Run `deploy-platform.yml`.
8. Run `api-image.yml`.
9. Wait for Deploy API to succeed.
10. Run `prober-image.yml`.
11. Wait for Deploy prober to succeed.
12. Run `frontend-image.yml`.
13. Wait for Deploy frontend to succeed.
14. Verify DNS, HTTPS, API health, dashboard access, and probe results.

Deploying the API before the prober ensures the shared `probe-auth` secret exists before probe submissions begin.

## Terraform variables

The active file is:

```text
terraform/terraform.tfvars
```

It is intentionally excluded from Git.

When configuring a new administration computer, create it from the example:

```bash
cp terraform/terraform.tfvars.example \
  terraform/terraform.tfvars
```

Populate the required values locally.

Never commit:

- AWS access keys
- Application bearer tokens
- Private keys
- Terraform state
- Populated `.tfvars` files
- Kubernetes Secret manifests containing real values

Confirm that the active variables file is ignored:

```bash
git check-ignore -v terraform/terraform.tfvars
```

## Terraform state

Terraform state is stored remotely so more than one administration computer can safely use the same infrastructure configuration.

Before planning or applying:

```bash
terraform -chdir=terraform init
terraform -chdir=terraform validate
terraform -chdir=terraform plan
```

Do not run simultaneous Terraform applies from multiple computers or terminals.

## Persistent data

Probe history and incidents are stored in DynamoDB rather than on the EC2 filesystem.

Replacing the EC2 instance does not remove DynamoDB data.

A complete Terraform destroy can delete the DynamoDB tables and their contents. Preserve or export required records before destroying the environment.

## Teardown warning

Review the destruction plan first:

```bash
terraform -chdir=terraform plan -destroy
```

A complete destroy can remove:

- The EC2 instance
- The Elastic IP
- IAM roles and policies
- ECR repositories and container images
- DynamoDB tables and stored data
- VPC networking resources
- The GitHub Actions AWS role

Destroy only after reviewing the plan:

```bash
terraform -chdir=terraform destroy
```

After destruction:

1. Remove or update the Cloudflare DNS record.
2. Expect the existing GitHub `AWS_ROLE_ARN` variable to reference a deleted role.
3. Recreate or update `AWS_ROLE_ARN` after provisioning the infrastructure again.
4. Confirm that no unwanted AWS resources continue generating costs.

## Security boundaries

- SSH port 22 is not exposed.
- Kubernetes API port 6443 is not exposed publicly.
- Administration uses AWS Systems Manager.
- GitHub authenticates to AWS using OpenID Connect.
- Application images are stored in private ECR repositories.
- Probe submissions require a bearer token.
- Incident-management requests require a separate bearer token.
- Public visitors receive read-only status information.
- Terraform state and populated `.tfvars` files remain outside Git.

## Current availability limitation

The platform currently uses one EC2 instance in one Availability Zone.

This means:

- It is not highly available.
- EC2 maintenance or failure can interrupt the dashboard.
- K3s control-plane and workload availability depend on the same server.
- Recovery is automated, but failover is not automatic.

A future production expansion could use multiple Kubernetes nodes, multiple probe regions, managed load balancing, and externally managed secret storage.