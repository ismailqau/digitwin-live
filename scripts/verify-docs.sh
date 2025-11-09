#!/bin/bash

# Documentation Verification Script
# Checks for broken links and missing files

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

log_header "Documentation Verification"

# Count documentation files
TOTAL_DOCS=$(find docs -name "*.md" -not -path "docs/archive/*" | wc -l | xargs)
ARCHIVED_DOCS=$(find docs/archive -name "*.md" 2>/dev/null | wc -l | xargs)

echo ""
log_info "Documentation Statistics:"
echo "  Active documents: $TOTAL_DOCS"
echo "  Archived documents: $ARCHIVED_DOCS"

# Check key files exist
echo ""
log_header "Checking Key Files"

KEY_FILES=(
    "README.md"
    "docs/README.md"
    "docs/INDEX.md"
    "docs/GETTING-STARTED.md"
    "docs/GCP-MANAGEMENT.md"
    "docs/GCP-QUICK-REFERENCE.md"
    "docs/GCP-CLEANUP-GUIDE.md"
    "docs/VECTOR-DATABASE.md"
    "docs/TROUBLESHOOTING.md"
)

MISSING=0
for file in "${KEY_FILES[@]}"; do
    if [ -f "$file" ]; then
        log_success "$file exists"
    else
        log_error "$file is missing"
        MISSING=$((MISSING + 1))
    fi
done

# Check for redundant files
echo ""
log_header "Checking for Redundant Files"

REDUNDANT_PATTERNS=(
    "CLEANUP-USAGE-GUIDE.md"
    "CLEANUP-SQL-GUIDE.md"
    "CLEANUP-IMPROVEMENTS.md"
    "SESSION-SUMMARY"
    "IMPROVEMENTS-SUMMARY"
    "FINAL-IMPROVEMENTS"
)

FOUND_REDUNDANT=0
for pattern in "${REDUNDANT_PATTERNS[@]}"; do
    if find docs -name "*$pattern*" -not -path "docs/archive/*" | grep -q .; then
        log_warning "Found redundant file matching: $pattern"
        find docs -name "*$pattern*" -not -path "docs/archive/*"
        FOUND_REDUNDANT=$((FOUND_REDUNDANT + 1))
    fi
done

if [ $FOUND_REDUNDANT -eq 0 ]; then
    log_success "No redundant files found"
fi

# Summary
echo ""
log_header "Verification Summary"

if [ $MISSING -eq 0 ] && [ $FOUND_REDUNDANT -eq 0 ]; then
    log_success "All checks passed!"
    echo ""
    log_info "Documentation structure:"
    echo "  ✅ All key files present"
    echo "  ✅ No redundant files"
    echo "  ✅ $TOTAL_DOCS active documents"
    echo "  ✅ $ARCHIVED_DOCS archived documents"
    exit 0
else
    log_error "Some checks failed"
    echo ""
    echo "  Missing files: $MISSING"
    echo "  Redundant files: $FOUND_REDUNDANT"
    exit 1
fi
