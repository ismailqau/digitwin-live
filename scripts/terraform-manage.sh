#!/bin/bash

# Terraform Management Script
# Single script for all Terraform operations

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_header() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

# Load environment
load_env() {
    if [ -f ".env" ]; then
        set -a
        while IFS='=' read -r key value; do
            if [[ ! "$key" =~ ^[[:space:]]*# ]] && [[ -n "$key" ]] && [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
                value=$(echo "$value" | sed 's/#.*//' | sed 's/^["'\'']//' | sed 's/["'\'']$//' | xargs)
                export "$key=$value"
            fi
        done < .env
        set +a
    fi
}

# Show usage
usage() {
    cat << EOF
Usage: $0 <command> [options]

Commands:
  init                Initialize Terraform (with backend)
  init-local          Initialize Terraform (local backend, no GCS)
  plan                Show what will change
  plan-monitoring     Show monitoring changes only
  apply               Apply all changes
  apply-monitoring    Apply monitoring changes only
  destroy             Destroy all resources
  destroy-monitoring  Destroy monitoring only
  validate            Validate configuration
  fmt                 Format Terraform files
  output              Show outputs
  state               Show state resources

Examples:
  $0 init              # Initialize with GCS backend
  $0 init-local        # Initialize with local backend (testing)
  $0 plan-monitoring   # Preview monitoring changes
  $0 apply-monitoring  # Deploy monitoring
  $0 output            # Show all outputs

EOF
    exit 1
}

# Initialize Terraform with GCS backend
terraform_init() {
    log_header "Initializing Terraform with GCS Backend"
    
    load_env
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set in .env"
        exit 1
    fi
    
    cd infrastructure/terraform
    
    # Determine environment
    ENV="dev"
    if [[ "$GCS_BUCKET_VOICE_MODELS" == *"-prod" ]]; then
        ENV="prod"
    fi
    
    log_info "Environment: $ENV"
    log_info "Backend: digitwinlive-terraform-state-$ENV"
    
    if terraform init -backend-config="backend-$ENV.hcl"; then
        log_success "Terraform initialized with GCS backend"
    else
        log_error "Terraform initialization failed"
        log_info "Try: $0 init-local (for local backend)"
        exit 1
    fi
}

# Initialize Terraform with local backend
terraform_init_local() {
    log_header "Initializing Terraform with Local Backend"
    
    cd infrastructure/terraform
    
    if terraform init -backend=false; then
        log_success "Terraform initialized with local backend"
        log_warning "State stored locally (not shared)"
    else
        log_error "Terraform initialization failed"
        exit 1
    fi
}

# Plan changes
terraform_plan() {
    log_header "Planning Terraform Changes"
    
    cd infrastructure/terraform
    terraform plan
}

# Plan monitoring only
terraform_plan_monitoring() {
    log_header "Planning Monitoring Changes"
    
    cd infrastructure/terraform
    terraform plan -target=module.monitoring
}

# Apply changes
terraform_apply() {
    log_header "Applying Terraform Changes"
    
    cd infrastructure/terraform
    terraform apply
}

# Apply monitoring only
terraform_apply_monitoring() {
    log_header "Applying Monitoring Changes"
    
    cd infrastructure/terraform
    terraform apply -target=module.monitoring
}

# Destroy resources
terraform_destroy() {
    log_header "Destroying Terraform Resources"
    
    log_warning "This will destroy ALL resources!"
    read -p "Are you sure? (yes/NO) " -r
    echo
    
    if [[ ! $REPLY =~ ^yes$ ]]; then
        log_info "Cancelled"
        return 0
    fi
    
    cd infrastructure/terraform
    terraform destroy
}

# Destroy monitoring only
terraform_destroy_monitoring() {
    log_header "Destroying Monitoring Resources"
    
    log_warning "This will destroy monitoring alerts and channels"
    read -p "Are you sure? (yes/NO) " -r
    echo
    
    if [[ ! $REPLY =~ ^yes$ ]]; then
        log_info "Cancelled"
        return 0
    fi
    
    cd infrastructure/terraform
    terraform destroy -target=module.monitoring
}

# Validate configuration
terraform_validate() {
    log_header "Validating Terraform Configuration"
    
    cd infrastructure/terraform
    
    if terraform validate; then
        log_success "Configuration is valid"
    else
        log_error "Configuration is invalid"
        exit 1
    fi
}

# Format files
terraform_fmt() {
    log_header "Formatting Terraform Files"
    
    cd infrastructure/terraform
    
    if terraform fmt -recursive; then
        log_success "Files formatted"
    else
        log_warning "Some files could not be formatted"
    fi
}

# Show outputs
terraform_output() {
    log_header "Terraform Outputs"
    
    cd infrastructure/terraform
    terraform output
}

# Show state
terraform_state() {
    log_header "Terraform State Resources"
    
    cd infrastructure/terraform
    terraform state list
}

# Main
main() {
    if [ $# -eq 0 ]; then
        usage
    fi
    
    COMMAND=$1
    shift
    
    case $COMMAND in
        init)
            terraform_init
            ;;
        init-local)
            terraform_init_local
            ;;
        plan)
            terraform_plan
            ;;
        plan-monitoring)
            terraform_plan_monitoring
            ;;
        apply)
            terraform_apply
            ;;
        apply-monitoring)
            terraform_apply_monitoring
            ;;
        destroy)
            terraform_destroy
            ;;
        destroy-monitoring)
            terraform_destroy_monitoring
            ;;
        validate)
            terraform_validate
            ;;
        fmt)
            terraform_fmt
            ;;
        output)
            terraform_output
            ;;
        state)
            terraform_state
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            usage
            ;;
    esac
}

main "$@"
