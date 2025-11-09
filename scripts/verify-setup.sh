#!/bin/bash

# Comprehensive setup verification script
# Verifies all quality gates, tests, and infrastructure

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

PASSED=0
FAILED=0
WARNINGS=0

# Function to run check
check() {
    local name=$1
    local command=$2
    
    log_info "Checking: $name"
    
    if eval "$command" > /dev/null 2>&1; then
        log_success "$name"
        PASSED=$((PASSED + 1))
        return 0
    else
        log_error "$name"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Function to run optional check
check_optional() {
    local name=$1
    local command=$2
    
    log_info "Checking: $name (optional)"
    
    if eval "$command" > /dev/null 2>&1; then
        log_success "$name"
        PASSED=$((PASSED + 1))
        return 0
    else
        log_warning "$name (optional - not critical)"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

log_header "Setup Verification"
echo ""

# 1. Node.js and pnpm
log_header "Environment"
check "Node.js installed" "command -v node"
check "pnpm installed" "command -v pnpm"
check "Node.js version >= 20" "node -v | grep -E 'v(20|21|22)'"
check "pnpm version >= 8" "pnpm -v | grep -E '^[89]'"

# 2. Dependencies
log_header "Dependencies"
check "node_modules exists" "[ -d node_modules ]"
check "Turbo installed" "command -v turbo || [ -f node_modules/.bin/turbo ]"
check "TypeScript installed" "[ -f node_modules/.bin/tsc ]"
check "Jest installed" "[ -f node_modules/.bin/jest ]"
check "ESLint installed" "[ -f node_modules/.bin/eslint ]"
check "Prettier installed" "[ -f node_modules/.bin/prettier ]"

# 3. Configuration Files
log_header "Configuration Files"
check "package.json exists" "[ -f package.json ]"
check "tsconfig.json exists" "[ -f tsconfig.base.json ]"
check "turbo.json exists" "[ -f turbo.json ]"
check ".eslintrc.js exists" "[ -f .eslintrc.js ]"
check ".prettierrc.js exists" "[ -f .prettierrc.js ]"
check "jest.config.base.js exists" "[ -f jest.config.base.js ]"

# 4. Git Hooks
log_header "Git Hooks"
check ".husky directory exists" "[ -d .husky ]"
check "pre-commit hook exists" "[ -f .husky/pre-commit ]"
check "commit-msg hook exists" "[ -f .husky/commit-msg ]"
check "pre-push hook exists" "[ -f .husky/pre-push ]"
check "pre-commit is executable" "[ -x .husky/pre-commit ]"
check "commit-msg is executable" "[ -x .husky/commit-msg ]"
check "pre-push is executable" "[ -x .husky/pre-push ]"

# 5. Quality Gate Files
log_header "Quality Gate Files"
check ".commitlintrc.js exists" "[ -f .commitlintrc.js ]"
check ".lintstagedrc.js exists" "[ -f .lintstagedrc.js ]"
check ".editorconfig exists" "[ -f .editorconfig ]"
check ".markdownlint.json exists" "[ -f .markdownlint.json ]"

# 6. Scripts
log_header "Scripts"
check "quality-check.sh exists" "[ -f scripts/quality-check.sh ]"
check "setup-tests.sh exists" "[ -f scripts/setup-tests.sh ]"
check "setup-quality-gates.sh exists" "[ -f scripts/setup-quality-gates.sh ]"
check "verify-docs.sh exists" "[ -f scripts/verify-docs.sh ]"
check "quality-check.sh is executable" "[ -x scripts/quality-check.sh ]"
check "setup-tests.sh is executable" "[ -x scripts/setup-tests.sh ]"

# 7. Test Setup
log_header "Test Setup"
check "jest.setup.base.ts exists" "[ -f jest.setup.base.ts ]"
check "test-utils package exists" "[ -d packages/test-utils ]"
check "API Gateway tests exist" "[ -f apps/api-gateway/jest.config.js ]"
check "WebSocket Server tests exist" "[ -f apps/websocket-server/jest.config.js ]"

# 8. Documentation
log_header "Documentation"
check "README.md exists" "[ -f README.md ]"
check "docs/INDEX.md exists" "[ -f docs/INDEX.md ]"
check "docs/CODE-QUALITY-GUIDE.md exists" "[ -f docs/CODE-QUALITY-GUIDE.md ]"
check "docs/TESTING-GUIDE.md exists" "[ -f docs/TESTING-GUIDE.md ]"
check "docs/GCP-MANAGEMENT.md exists" "[ -f docs/GCP-MANAGEMENT.md ]"

# 9. GCP Scripts
log_header "GCP Scripts"
check "gcp-setup.sh exists" "[ -f scripts/gcp-setup.sh ]"
check "gcp-manage.sh exists" "[ -f scripts/gcp-manage.sh ]"
check "gcp-cleanup.sh exists" "[ -f scripts/gcp-cleanup.sh ]"
check "gcp-setup.sh is executable" "[ -x scripts/gcp-setup.sh ]"

# 10. Environment
log_header "Environment Files"
check ".env.example exists" "[ -f .env.example ]"
check_optional ".env exists" "[ -f .env ]"
check_optional ".env.development exists" "[ -f .env.development ]"

# 11. Workspaces
log_header "Workspaces"
check "apps directory exists" "[ -d apps ]"
check "services directory exists" "[ -d services ]"
check "packages directory exists" "[ -d packages ]"
check "API Gateway exists" "[ -d apps/api-gateway ]"
check "WebSocket Server exists" "[ -d apps/websocket-server ]"

# 12. Optional Tools
log_header "Optional Tools"
check_optional "Docker installed" "command -v docker"
check_optional "PostgreSQL client installed" "command -v psql"
check_optional "gcloud CLI installed" "command -v gcloud"
check_optional "kubectl installed" "command -v kubectl"

# 13. NPM Scripts
log_header "NPM Scripts"
check "test script exists" "grep -q '\"test\"' package.json"
check "lint script exists" "grep -q '\"lint\"' package.json"
check "format script exists" "grep -q '\"format\"' package.json"
check "build script exists" "grep -q '\"build\"' package.json"
check "quality:check script exists" "grep -q '\"quality:check\"' package.json"
check "validate script exists" "grep -q '\"validate\"' package.json"

# Summary
echo ""
log_header "Verification Summary"
echo ""

TOTAL=$((PASSED + FAILED + WARNINGS))

echo "  Total checks: $TOTAL"
echo "  ✅ Passed: $PASSED"
echo "  ❌ Failed: $FAILED"
echo "  ⚠️  Warnings: $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
    log_success "All critical checks passed! ✨"
    echo ""
    log_info "Your setup is complete and ready to use!"
    echo ""
    log_info "Next steps:"
    echo "  1. Run 'pnpm test' to verify tests work"
    echo "  2. Run 'pnpm lint' to check code quality"
    echo "  3. Run 'pnpm validate' to run all checks"
    echo "  4. Start developing with 'pnpm dev'"
    echo ""
    exit 0
else
    log_error "$FAILED critical check(s) failed"
    echo ""
    log_info "Please fix the failed checks and run again"
    echo ""
    exit 1
fi
