#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: deploy-frontend.sh <image-tag>"
  exit 1
fi

image_tag="$1"

if [[ ! "$image_tag" =~ ^sha-[0-9a-f]{40}-run-[0-9]+-[0-9]+$ ]]; then
  echo "Invalid frontend image tag: $image_tag"
  exit 1
fi

aws_region="eu-north-1"
aws_account_id="820932217554"
namespace="status-platform"
repository="${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com/status-platform-dev-frontend"
image_uri="${repository}:${image_tag}"
manifest_url="https://raw.githubusercontent.com/TravelReg/status-platform/main/k8s/frontend.yaml"

source_manifest=$(mktemp /tmp/status-frontend-source.XXXXXX.yaml)
rendered_manifest=$(mktemp /tmp/status-frontend-rendered.XXXXXX.yaml)

cleanup() {
  rm -f -- "$source_manifest" "$rendered_manifest"
}

trap cleanup EXIT

curl --fail \
  --silent \
  --show-error \
  --location \
  --retry 5 \
  "$manifest_url" \
  --output "$source_manifest"

sed -E \
  "s|^([[:space:]]*image:[[:space:]]*).*status-platform-dev-frontend:.*$|\1${image_uri}|" \
  "$source_manifest" > "$rendered_manifest"

if ! grep -Fq "image: ${image_uri}" "$rendered_manifest"; then
  echo "Failed to insert the frontend image into the manifest."
  exit 1
fi

k3s kubectl create namespace "$namespace" \
  --dry-run=client \
  --output yaml |
k3s kubectl apply -f -

ecr_password=$(aws ecr get-login-password --region "$aws_region")

k3s kubectl create secret docker-registry ecr-pull \
  --namespace "$namespace" \
  --docker-server="${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com" \
  --docker-username=AWS \
  --docker-password="$ecr_password" \
  --dry-run=client \
  --output yaml |
k3s kubectl apply -f -

unset ecr_password

echo "Deploying ${image_uri}."

k3s kubectl apply -f "$rendered_manifest"

k3s kubectl rollout status \
  deployment/status-frontend \
  --namespace "$namespace" \
  --timeout=180s

k3s kubectl get pods \
  --namespace "$namespace" \
  --selector app=status-frontend \
  --output wide

service_ip=$(k3s kubectl get service status-frontend \
  --namespace "$namespace" \
  --output jsonpath='{.spec.clusterIP}')

curl --fail \
  --silent \
  --show-error \
  "http://${service_ip}/healthz"

echo

curl --fail \
  --silent \
  --show-error \
  "http://${service_ip}/" |
grep --fixed-strings '<div id="root"></div>'

echo "Frontend deployment completed successfully."
