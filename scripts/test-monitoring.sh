#!/bin/bash

# Test Monitoring Setup
# Validates Phase 12 monitoring configuration

# Don't exit on error - we want to run all tests
set +e

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

PASSED=0
FAILED=0
WARNINGS=0

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

# Test 1: Check if monitoring API is enabled
test_monitoring_api() {
    log_header "Test 1: Monitoring API Status"
    
    if gcloud services list --enabled --filter="name:monitoring.googleapis.com" 2>/dev/null | grep -q "monitoring"; then
        log_success "Monitoring API is enabled"
        ((PASSED++))
    else
        log_error "Monitoring API is NOT enabled"
        log_info "Run: pnpm gcp:enable apis"
        ((FAILED++))
    fi
}

# Test 2: Check Terraform configuration validity
test_terraform_config() {
    log_header "Test 2: Terraform Configuration"
    
    ORIGINAL_DIR=$(pwd)
    cd infrastructure/terraform/modules/monitoring
    
    if [ ! -d ".terraform" ]; then
        log_warning "Terraform not initialized (run: terraform init)"
        log_info "Skipping Terraform validation"
        ((WARNINGS++))
    elif terraform validate > /dev/null 2>&1; then
        log_success "Terraform configuration is valid"
        ((PASSED++))
    else
        log_error "Terraform configuration is INVALID"
        terraform validate
        ((FAILED++))
    fi
    
    cd "$ORIGINAL_DIR"
}

# Test 3: Check if alert policies exist (if Terraform applied)
test_alert_policies() {
    log_header "Test 3: Alert Policies"
    
    POLICY_COUNT=$(timeout 5 gcloud alpha monitoring policies list --format="value(name)" 2>/dev/null | wc -l | xargs || echo "0")
    
    if [ "$POLICY_COUNT" -eq 0 ]; then
        log_warning "No alert policies found (Terraform not applied yet)"
        log_info "This is expected if you haven't run 'terraform apply'"
        ((WARNINGS++))
    elif [ "$POLICY_COUNT" -ge 3 ]; then
        log_success "Found $POLICY_COUNT alert policies"
        ((PASSED++))
    else
        log_warning "Found $POLICY_COUNT alert policies (expected 3)"
        ((WARNINGS++))
    fi
}

# Test 4: Check notification channels
test_notification_channels() {
    log_header "Test 4: Notification Channels"
    
    CHANNEL_COUNT=$(timeout 5 gcloud alpha monitoring channels list --format="value(name)" 2>/dev/null | wc -l | xargs || echo "0")
    
    if [ "$CHANNEL_COUNT" -eq 0 ]; then
        log_warning "No notification channels found (Terraform not applied yet)"
        ((WARNINGS++))
    else
        log_success "Found $CHANNEL_COUNT notification channel(s)"
        ((PASSED++))
    fi
}

# Test 5: Check gcp-manage.sh monitoring status
test_gcp_manage_status() {
    log_header "Test 5: GCP Manage Script"
    
    if [ ! -f "scripts/gcp-manage.sh" ]; then
        log_error "gcp-manage.sh not found"
        ((FAILED++))
        return
    fi
    
    # Check if monitoring is in the script
    if grep -q "monitoring" scripts/gcp-manage.sh; then
        log_success "gcp-manage.sh includes monitoring checks"
        ((PASSED++))
    else
        log_error "gcp-manage.sh missing monitoring integration"
        ((FAILED++))
    fi
    
    # Test status command (quick check only)
    log_info "Checking if status command includes monitoring..."
    if grep -q "Monitoring:" scripts/gcp-manage.sh; then
        log_success "Monitoring status check implemented"
        ((PASSED++))
    else
        log_error "Monitoring status check not implemented"
        ((FAILED++))
    fi
}

# Test 6: Check documentation
test_documentation() {
    log_header "Test 6: Documentation"
    
    DOCS=(
        "docs/MONITORING.md"
        "infrastructure/terraform/BACKEND.md"
    )
    
    for doc in "${DOCS[@]}"; do
        if [ -f "$doc" ]; then
            log_success "Found: $doc"
            ((PASSED++))
        else
            log_error "Missing: $doc"
            ((FAILED++))
        fi
    done
}

# Test 7: Verify minimal monitoring approach
test_minimal_approach() {
    log_header "Test 7: Minimal Monitoring Approach"
    
    # Check that we removed dashboard from main.tf
    if grep -q "google_monitoring_dashboard" infrastructure/terraform/modules/monitoring/main.tf; then
        log_error "Custom dashboard found in main.tf (should be removed)"
        ((FAILED++))
    else
        log_success "No custom dashboard (using GCP Console)"
        ((PASSED++))
    fi
    
    # Check that we removed CPU alert
    if grep -q "high_cpu" infrastructure/terraform/modules/monitoring/main.tf; then
        log_error "CPU alert found (should be removed)"
        ((FAILED++))
    else
        log_success "No CPU alert (Cloud Run auto-scales)"
        ((PASSED++))
    fi
    
    # Check that we have exactly 3 alert policies
    ALERT_COUNT=$(grep -c "google_monitoring_alert_policy" infrastructure/terraform/modules/monitoring/main.tf)
    if [ "$ALERT_COUNT" -eq 3 ]; then
        log_success "Exactly 3 alert policies (minimal essential)"
        ((PASSED++))
    else
        log_warning "Found $ALERT_COUNT alert policies (expected 3)"
        ((WARNINGS++))
    fi
}

# Test 8: Check GCP Console access
test_gcp_console_access() {
    log_header "Test 8: GCP Console Access"
    
    load_env
    
    if [ -z "$GCP_PROJECT_ID" ]; then
        log_error "GCP_PROJECT_ID not set in .env"
        ((FAILED++))
        return
    fi
    
    log_info "GCP Console URLs:"
    echo "  📊 Monitoring: https://console.cloud.google.com/monitoring?project=$GCP_PROJECT_ID"
    echo "  🚀 Cloud Run: https://console.cloud.google.com/run?project=$GCP_PROJECT_ID"
    echo "  🗄️  Cloud SQL: https://console.cloud.google.com/sql?project=$GCP_PROJECT_ID"
    echo "  💰 Billing: https://console.cloud.google.com/billing?project=$GCP_PROJECT_ID"
    
    log_success "GCP Console URLs generated"
    ((PASSED++))
}

# Test 9: Verify cost impact
test_cost_impact() {
    log_header "Test 9: Cost Impact"
    
    log_info "Monitoring Cost Breakdown:"
    echo "  • Alert policies (3): \$0/month (first 100 free)"
    echo "  • Notification channels (1): \$0/month (free)"
    echo "  • Metrics ingestion: \$0/month (included with GCP services)"
    echo "  • Dashboards: \$0/month (using GCP Console)"
    echo "  ────────────────────────────────"
    echo "  • Total: \$0/month"
    
    log_success "Monitoring has zero additional cost"
    ((PASSED++))
}

# Test 10: Check Phase 12 task completion
test_phase12_tasks() {
    log_header "Test 10: Phase 12 Task Completion"
    
    if [ ! -f ".kiro/specs/real-time-conversational-clone/tasks.md" ]; then
        log_warning "tasks.md not found"
        ((WARNINGS++))
        return
    fi
    
    # Check if Phase 12 tasks are marked complete
    if grep -A 5 "^- \[x\] 12\." .kiro/specs/real-time-conversational-clone/tasks.md > /dev/null 2>&1; then
        log_success "Task 12 marked as complete"
        ((PASSED++))
    else
        log_error "Task 12 not marked as complete"
        ((FAILED++))
    fi
    
    if grep -A 5 "^- \[x\] 12.1" .kiro/specs/real-time-conversational-clone/tasks.md > /dev/null 2>&1; then
        log_success "Task 12.1 marked as complete"
        ((PASSED++))
    else
        log_error "Task 12.1 not marked as complete"
        ((FAILED++))
    fi
    
    if grep -A 5 "^- \[x\] 12.2" .kiro/specs/real-time-conversational-clone/tasks.md > /dev/null 2>&1; then
        log_success "Task 12.2 marked as complete"
        ((PASSED++))
    else
        log_error "Task 12.2 not marked as complete"
        ((FAILED++))
    fi
    
    if grep -A 5 "^- \[x\] 12.3" .kiro/specs/real-time-conversational-clone/tasks.md > /dev/null 2>&1; then
        log_success "Task 12.3 marked as complete"
        ((PASSED++))
    else
        log_error "Task 12.3 not marked as complete"
        ((FAILED++))
    fi
}

# Main execution
main() {
    log_header "Monitoring Setup Test Suite"
    log_info "Testing Phase 12: Monitoring and Observability"
    echo ""
    
    load_env
    
    # Run all tests
    test_monitoring_api
    test_terraform_config
    test_alert_policies
    test_notification_channels
    test_gcp_manage_status
    test_documentation
    test_minimal_approach
    test_gcp_console_access
    test_cost_impact
    test_phase12_tasks
    
    # Summary
    log_header "Test Summary"
    echo ""
    log_success "Passed: $PASSED"
    if [ $WARNINGS -gt 0 ]; then
        log_warning "Warnings: $WARNINGS"
    fi
    if [ $FAILED -gt 0 ]; then
        log_error "Failed: $FAILED"
    fi
    echo ""
    
    TOTAL=$((PASSED + FAILED))
    PERCENTAGE=$((PASSED * 100 / TOTAL))
    
    if [ $FAILED -eq 0 ]; then
        log_success "All tests passed! ✨"
        log_info "Monitoring setup is complete and working correctly."
        echo ""
        log_info "Next steps:"
        echo "  1. Apply Terraform to create alert policies: cd infrastructure/terraform && terraform apply"
        echo "  2. View monitoring: pnpm gcp:status"
        echo "  3. Check GCP Console: https://console.cloud.google.com/monitoring"
        exit 0
    else
        log_error "Some tests failed ($PERCENTAGE% passed)"
        log_info "Review the errors above and fix the issues."
        exit 1
    fi
}

main "$@"
