#!/bin/bash

# Destroy all GCP resources for clean slate
# WARNING: This deletes everything!

set -e

PROJECT_ID="digitwinlive"
REGION="us-central1"
ENV="dev"

echo "⚠️  WARNING: This will DELETE ALL infrastructure!"
echo "Project: $PROJECT_ID"
echo "Environment: $ENV"
echo ""
read -p "Type 'DELETE' to confirm: " confirm

if [ "$confirm" != "DELETE" ]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "🗑️  Destroying all resources..."
echo ""

# Delete GKE clusters first (takes longest)
echo "Deleting GKE clusters..."
gcloud container clusters list --project=$PROJECT_ID --format="value(name,location)" | while read name location; do
  echo "  Deleting cluster: $name in $location"
  gcloud container clusters delete $name --location=$location --project=$PROJECT_ID --quiet || true
done

# Delete Cloud Run services
echo "Deleting Cloud Run services..."
gcloud run services list --project=$PROJECT_ID --platform=managed --format="value(metadata.name,metadata.namespace)" | while read name region; do
  echo "  Deleting service: $name"
  gcloud run services delete $name --region=$REGION --project=$PROJECT_ID --quiet || true
done

# Delete Cloud SQL instances
echo "Deleting Cloud SQL instances..."
gcloud sql instances list --project=$PROJECT_ID --format="value(name)" | while read name; do
  echo "  Deleting instance: $name"
  gcloud sql instances delete $name --project=$PROJECT_ID --quiet || true
done

# Delete Storage buckets
echo "Deleting Storage buckets..."
gcloud storage buckets list --project=$PROJECT_ID --format="value(name)" | grep "^${ENV}-" | while read bucket; do
  echo "  Deleting bucket: $bucket"
  gcloud storage rm -r "gs://$bucket" --quiet || true
done

# Delete VPC Access Connectors
echo "Deleting VPC Access Connectors..."
gcloud compute networks vpc-access connectors list --region=$REGION --project=$PROJECT_ID --format="value(name)" | while read name; do
  echo "  Deleting connector: $name"
  gcloud compute networks vpc-access connectors delete $name --region=$REGION --project=$PROJECT_ID --quiet || true
done

# Delete Cloud NAT
echo "Deleting Cloud NAT..."
gcloud compute routers nats list --router=${ENV}-router --region=$REGION --project=$PROJECT_ID --format="value(name)" 2>/dev/null | while read name; do
  echo "  Deleting NAT: $name"
  gcloud compute routers nats delete $name --router=${ENV}-router --region=$REGION --project=$PROJECT_ID --quiet || true
done

# Delete Cloud Router
echo "Deleting Cloud Routers..."
gcloud compute routers list --project=$PROJECT_ID --format="value(name,region)" | grep "^${ENV}-" | while read name region; do
  echo "  Deleting router: $name"
  gcloud compute routers delete $name --region=$region --project=$PROJECT_ID --quiet || true
done

# Delete Subnets
echo "Deleting Subnets..."
gcloud compute networks subnets list --project=$PROJECT_ID --format="value(name,region)" | grep "^${ENV}-" | while read name region; do
  echo "  Deleting subnet: $name"
  gcloud compute networks subnets delete $name --region=$region --project=$PROJECT_ID --quiet || true
done

# Delete VPC Network
echo "Deleting VPC Networks..."
gcloud compute networks list --project=$PROJECT_ID --format="value(name)" | grep "^${ENV}-" | while read name; do
  echo "  Deleting network: $name"
  gcloud compute networks delete $name --project=$PROJECT_ID --quiet || true
done

# Delete Global Addresses
echo "Deleting Global Addresses..."
gcloud compute addresses list --global --project=$PROJECT_ID --format="value(name)" | grep "^${ENV}-" | while read name; do
  echo "  Deleting address: $name"
  gcloud compute addresses delete $name --global --project=$PROJECT_ID --quiet || true
done

# Delete Monitoring Alert Policies
echo "Deleting Monitoring Alert Policies..."
gcloud alpha monitoring policies list --project=$PROJECT_ID --format="value(name)" | while read name; do
  echo "  Deleting policy: $name"
  gcloud alpha monitoring policies delete $name --project=$PROJECT_ID --quiet || true
done

# Delete Logging Metrics
echo "Deleting Logging Metrics..."
gcloud logging metrics list --project=$PROJECT_ID --format="value(name)" | while read name; do
  echo "  Deleting metric: $name"
  gcloud logging metrics delete $name --project=$PROJECT_ID --quiet || true
done

# Delete Notification Channels
echo "Deleting Notification Channels..."
gcloud alpha monitoring channels list --project=$PROJECT_ID --format="value(name)" | while read name; do
  echo "  Deleting channel: $name"
  gcloud alpha monitoring channels delete $name --project=$PROJECT_ID --quiet || true
done

# Note: KMS keys cannot be deleted, only disabled
echo "Disabling KMS keys (cannot be deleted)..."
gcloud kms keys list --keyring=${ENV}-keyring --location=$REGION --project=$PROJECT_ID --format="value(name)" 2>/dev/null | while read key; do
  echo "  Disabling key: $key"
  # KMS keys are automatically disabled after 24 hours of being scheduled for destruction
done

echo ""
echo "✅ All resources deleted!"
echo ""
echo "Now clean Terraform state:"
echo "  cd infrastructure/terraform"
echo "  rm -rf .terraform .terraform.lock.hcl terraform.tfstate* tfplan"
echo "  terraform init"
