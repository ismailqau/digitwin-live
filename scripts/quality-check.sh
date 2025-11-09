#!/bin/bash

# Comprehensive quality check script
# Runs all quality gates before deployment

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

FAILED=0

# Function to run check and track failures
run_check() {
    local name=$1
    shift
    
    log_header "$name"
    if "$@"; then
        log_success "$name passed"
    else
        log_error "$name failed"
        FAILED=$((FAILED + 1))
    fi
}

log_header "Quality Check Suite"
echo ""
log_info "Running comprehensive quality checks..."
echo ""

# 1. Linting
run_check "ESLint" pnpm lint

# 2. Type checking
run_check "TypeScript" pnpm type-check

# 3. Formatting
run_check "Prettier" pnpm format:check

# 4. Tests
run_check "Unit Tests" pnpm test

# 5. Build
run_check "Build" pnpm build

# 6. Security audit
run_check "Security Audit" pnpm audit:check

# 7. Dependency check
run_check "Dependency Check" pnpm outdated:check || true

# 8. Documentation
run_check "Documentation" pnpm docs:verify

# 9. Code complexity
run_check "Code Complexity" pnpm complexity:check || true

# 10. Test coverage
run_check "Test Coverage" pnpm coverage:check || true

# Summary
echo ""
log_header "Quality Check Summary"
echo ""

if [ $FAILED -eq 0 ]; then
    log_success "All quality checks passed! ✨"
    exit 0
else
    log_error "$FAILED check(s) failed"
    exit 1
fi
