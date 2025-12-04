#!/bin/bash

# Master setup script - Sets up everything for the project

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_header() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

echo ""
log_header "DigiTwin Live - Complete Setup"
echo ""
log_info "This script will set up your development environment"
echo ""

# 1. Install dependencies
log_header "Step 1: Installing Dependencies"
log_info "Running pnpm install..."
pnpm install
log_success "Dependencies installed"

# 2. Setup quality gates
log_header "Step 2: Setting Up Quality Gates"
log_info "Configuring pre-commit hooks, linting, and formatting..."
./scripts/setup-quality-gates.sh
log_success "Quality gates configured"

# 3. Setup tests
log_header "Step 3: Setting Up Tests"
log_info "Configuring test infrastructure..."
./scripts/setup-tests.sh
log_success "Tests configured"

# 4. Verify setup
log_header "Step 4: Verifying Setup"
log_info "Running verification checks..."
./scripts/verify-setup.sh

# 5. Final message
echo ""
log_header "Setup Complete! 🎉"
echo ""
log_success "Your development environment is ready!"
echo ""
log_info "Quick Start Commands:"
echo ""
echo "  Development:"
echo "    pnpm dev              # Start development servers"
echo "    pnpm build            # Build all packages"
echo ""
echo "  Quality Checks:"
echo "    pnpm lint             # Run linting"
echo "    pnpm format           # Format code"
echo "    pnpm test             # Run tests"
echo "    pnpm validate         # Run all checks"
echo ""
echo "  GCP Management:"
echo "    pnpm gcp:setup        # Setup GCP infrastructure"
echo "    pnpm gcp:status       # Check GCP status"
echo "    pnpm gcp:cleanup-sql  # Cleanup SQL instances"
echo ""
echo "  Documentation:"
echo "    docs/README.md                # Documentation hub"
echo "    docs/CODE-QUALITY-GUIDE.md    # Code quality guide"
echo "    docs/TESTING-GUIDE.md         # Testing guide"
echo "    docs/GCP-MANAGEMENT.md        # GCP management guide"
echo ""
log_info "Happy coding! 🚀"
echo ""
