#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: deploy-prober.sh <image-tag>"
  exit 1
fi

image_tag="$1"

if [[ ! "$image_tag" =~ ^sha-[0-9a-f]{40}-run-[0-9]+-[0-9]+$ ]]; then
  echo "Invalid prober image tag: $image_tag"
  exit 1
fi

aws_region="eu-north-1"
aws_account_id="820932217554"
namespace="status-platform"
repository="${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com/status-platform-dev-prober"
image_uri="${repository}:${image_tag}"
manifest_url="https://raw.githubusercontent.com/TravelReg/status-platform/main/k8s/prober.yaml"

source_manifest=$(mktemp /tmp/status-prober-source.XXXXXX.yaml)
rendered_manifest=$(mktemp /tmp/status-prober-rendered.XXXXXX.yaml)

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
  "s|^([[:space:]]*image:[[:space:]]*).*status-platform-dev-prober:.*$|\1${image_uri}|" \
  "$source_manifest" > "$rendered_manifest"

if ! grep -Fq "image: ${image_uri}" "$rendered_manifest"; then
  echo "Failed to insert the new prober image into the manifest."
  exit 1
fi

k3s kubectl create namespace "$namespace" \
  --dry-run=client \
  --output yaml |
k3s kubectl apply -f -

if ! k3s kubectl get secret probe-auth \
  --namespace "$namespace" >/dev/null 2>&1; then
  echo "Creating internal probe authentication secret."

  probe_token=$(openssl rand -hex 32)

  k3s kubectl create secret generic probe-auth \
    --namespace "$namespace" \
    --from-literal=token="$probe_token"

  unset probe_token
fi

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
  deployment/status-prober \
  --namespace "$namespace" \
  --timeout=180s

k3s kubectl get pods \
  --namespace "$namespace" \
  --selector app=status-prober \
  --output wide

echo "Recent prober output:"

k3s kubectl logs \
  --namespace "$namespace" \
  deployment/status-prober \
  --tail=20

echo "Prober deployment completed successfully."
