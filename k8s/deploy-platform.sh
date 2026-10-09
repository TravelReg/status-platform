#!/usr/bin/env bash
set -euo pipefail

CERT_MANAGER_VERSION="v1.21.2"
REPOSITORY_RAW_URL="https://raw.githubusercontent.com/TravelReg/status-platform/main"
NAMESPACE="status-platform"
DOMAIN="status.travelregger.com"

cert_manager_manifest=$(mktemp /tmp/cert-manager.XXXXXX.yaml)
issuer_manifest=$(mktemp /tmp/status-issuer.XXXXXX.yaml)
ingress_manifest=$(mktemp /tmp/status-ingress.XXXXXX.yaml)

cleanup() {
  rm -f \
    "$cert_manager_manifest" \
    "$issuer_manifest" \
    "$ingress_manifest"
}

trap cleanup EXIT

if ! command -v k3s >/dev/null 2>&1; then
  echo "K3s is not installed."
  exit 1
fi

echo "Ensuring the application namespace exists."

k3s kubectl create namespace "$NAMESPACE" \
  --dry-run=client \
  --output yaml |
  k3s kubectl apply -f -

echo "Downloading cert-manager ${CERT_MANAGER_VERSION}."

curl --fail \
  --silent \
  --show-error \
  --location \
  --retry 5 \
  "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml" \
  --output "$cert_manager_manifest"

echo "Installing or updating cert-manager."

k3s kubectl apply -f "$cert_manager_manifest"

for deployment in \
  cert-manager \
  cert-manager-webhook \
  cert-manager-cainjector
do
  k3s kubectl rollout status \
    "deployment/${deployment}" \
    --namespace cert-manager \
    --timeout=300s
done

echo "Downloading the issuer and HTTPS ingress manifests."

curl --fail \
  --silent \
  --show-error \
  --location \
  --retry 5 \
  "${REPOSITORY_RAW_URL}/k8s/cert-manager.yaml" \
  --output "$issuer_manifest"

curl --fail \
  --silent \
  --show-error \
  --location \
  --retry 5 \
  "${REPOSITORY_RAW_URL}/k8s/ingress.yaml" \
  --output "$ingress_manifest"

echo "Applying the Let's Encrypt ClusterIssuer."

k3s kubectl apply -f "$issuer_manifest"

k3s kubectl wait \
  --for=condition=Ready \
  clusterissuer/letsencrypt-production \
  --timeout=300s

echo "Applying the HTTPS ingress."

k3s kubectl apply -f "$ingress_manifest"

echo "Waiting for cert-manager to create the Certificate resource."

for attempt in $(seq 1 30); do
  if k3s kubectl get certificate status-platform-tls \
    --namespace "$NAMESPACE" >/dev/null 2>&1
  then
    break
  fi

  sleep 2
done

k3s kubectl get certificate status-platform-tls \
  --namespace "$NAMESPACE" >/dev/null

echo "Waiting for the TLS certificate to become ready."

if ! k3s kubectl wait \
  --for=condition=Ready \
  certificate/status-platform-tls \
  --namespace "$NAMESPACE" \
  --timeout=300s
then
  k3s kubectl get \
    certificate,certificaterequest,order,challenge \
    --namespace "$NAMESPACE"

  k3s kubectl describe certificate status-platform-tls \
    --namespace "$NAMESPACE"

  exit 1
fi

echo "Verifying the public HTTPS API."

curl --fail \
  --silent \
  --show-error \
  --retry 10 \
  --retry-delay 5 \
  "https://${DOMAIN}/api/health"

echo
echo "Platform configuration deployed successfully."
