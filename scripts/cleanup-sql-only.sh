#!/bin/bash

# Quick script to delete specific Cloud SQL instances
# This is a standalone version for testing

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

log_header "Cloud SQL Instance Cleanup"

# Get all Cloud SQL instances
INSTANCES=$(gcloud sql instances list --format="value(name)" 2>/dev/null)

if [ -z "$INSTANCES" ]; then
    log_info "No Cloud SQL instances found"
    exit 0
fi

# Count instances
INSTANCE_COUNT=$(echo "$INSTANCES" | wc -l | xargs)

echo ""
log_info "Found $INSTANCE_COUNT Cloud SQL instances:"
echo ""

# Display instances with details
gcloud sql instances list --format="table(name,databaseVersion,region,tier,ipAddresses[0].ipAddress,state)" 2>/dev/null

echo ""
log_warning "Select instances to delete:"
echo ""

# Create array of instances
IFS=$'\n' read -d '' -r -a INSTANCE_ARRAY <<< "$INSTANCES" || true

# Show menu
for i in "${!INSTANCE_ARRAY[@]}"; do
    echo "  $((i+1))) ${INSTANCE_ARRAY[$i]}"
done
echo "  $((${#INSTANCE_ARRAY[@]}+1))) All instances"
echo "  $((${#INSTANCE_ARRAY[@]}+2))) Cancel"
echo ""

read -p "Enter choices (comma-separated, e.g., 1,3): " INSTANCE_CHOICES

# Parse choices
if [[ $INSTANCE_CHOICES == "$((${#INSTANCE_ARRAY[@]}+2))" ]]; then
    log_info "Cancelled"
    exit 0
fi

# Show what will be deleted
echo ""
log_warning "You selected to delete:"
if [[ $INSTANCE_CHOICES == "$((${#INSTANCE_ARRAY[@]}+1))" ]]; then
    for instance in "${INSTANCE_ARRAY[@]}"; do
        echo "  ✓ $instance"
    done
else
    IFS=',' read -ra CHOICES <<< "$INSTANCE_CHOICES"
    for choice in "${CHOICES[@]}"; do
        choice=$(echo "$choice" | xargs)
        if [[ $choice =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#INSTANCE_ARRAY[@]}" ]; then
            echo "  ✓ ${INSTANCE_ARRAY[$((choice-1))]}"
        fi
    done
fi

echo ""
read -p "Confirm deletion? (yes/NO) " -r
echo

if [[ ! $REPLY =~ ^yes$ ]]; then
    log_info "Cancelled"
    exit 0
fi

# Delete instances
if [[ $INSTANCE_CHOICES == "$((${#INSTANCE_ARRAY[@]}+1))" ]]; then
    # Delete all
    for instance in "${INSTANCE_ARRAY[@]}"; do
        log_warning "Deleting Cloud SQL instance: $instance..."
        gcloud sql instances delete "$instance" --quiet 2>/dev/null || log_error "Failed to delete $instance"
        log_success "Cloud SQL instance $instance deleted"
    done
else
    # Delete selected instances
    IFS=',' read -ra CHOICES <<< "$INSTANCE_CHOICES"
    for choice in "${CHOICES[@]}"; do
        choice=$(echo "$choice" | xargs)
        if [[ $choice =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#INSTANCE_ARRAY[@]}" ]; then
            instance="${INSTANCE_ARRAY[$((choice-1))]}"
            log_warning "Deleting Cloud SQL instance: $instance..."
            gcloud sql instances delete "$instance" --quiet 2>/dev/null || log_error "Failed to delete $instance"
            log_success "Cloud SQL instance $instance deleted"
        else
            log_warning "Invalid choice: $choice"
        fi
    done
fi

echo ""
log_success "Cleanup complete!"
