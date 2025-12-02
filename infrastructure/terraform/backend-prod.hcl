# Backend configuration for production environment
# Usage: terraform init -backend-config=backend-prod.hcl

bucket = "digitwinlive-terraform-state-prod"
prefix = "terraform/state"
