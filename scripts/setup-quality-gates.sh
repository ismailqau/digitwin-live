#!/bin/bash

# Setup script for quality gates and pre-commit hooks

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }

echo ""
log_info "Setting up quality gates and pre-commit hooks..."
echo ""

# Install dependencies
log_info "Installing dependencies..."
pnpm install
log_success "Dependencies installed"

# Setup Husky
log_info "Setting up Husky..."
pnpm prepare
log_success "Husky configured"

# Make hooks executable
log_info "Making hooks executable..."
chmod +x .husky/pre-commit .husky/commit-msg .husky/pre-push
log_success "Hooks are executable"

# Make scripts executable
log_info "Making scripts executable..."
chmod +x scripts/quality-check.sh
log_success "Scripts are executable"

# Run initial validation
log_info "Running initial validation..."
pnpm lint:fix || true
pnpm format || true
log_success "Initial validation complete"

echo ""
log_success "Quality gates setup complete! 🎉"
echo ""
log_info "Next steps:"
echo "  1. Run 'pnpm validate' to check everything works"
echo "  2. Make a commit to test pre-commit hooks"
echo "  3. Read docs/CODE-QUALITY-GUIDE.md for details"
echo ""
