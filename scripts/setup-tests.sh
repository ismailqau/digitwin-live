#!/bin/bash

# Setup tests across all workspaces

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo ""
log_info "Setting up tests across all workspaces..."
echo ""

# Function to create jest config for a workspace
create_jest_config() {
    local workspace=$1
    local display_name=$2
    
    cat > "$workspace/jest.config.js" << EOF
const baseConfig = require('../../jest.config.base');

/** @type {import('jest').Config} */
module.exports = {
  ...baseConfig,
  displayName: '$display_name',
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  coveragePathIgnorePatterns: [
    ...baseConfig.coveragePathIgnorePatterns || [],
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],
};
EOF
    log_success "Created jest.config.js for $display_name"
}

# Function to create jest setup for a workspace
create_jest_setup() {
    local workspace=$1
    local display_name=$2
    
    cat > "$workspace/jest.setup.ts" << EOF
// $display_name test setup
import '../../jest.setup.base';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Mock logger
jest.mock('@clone/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));
EOF
    log_success "Created jest.setup.ts for $display_name"
}

# Function to create sample test
create_sample_test() {
    local workspace=$1
    local display_name=$2
    
    mkdir -p "$workspace/src/__tests__"
    
    cat > "$workspace/src/__tests__/health.test.ts" << EOF
// Example test for $display_name
describe('$display_name Health Check', () => {
  it('should pass basic test', () => {
    expect(true).toBe(true);
  });

  it('should have test environment configured', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});
EOF
    log_success "Created sample test for $display_name"
}

# Setup apps
log_info "Setting up tests for apps..."

# WebSocket Server
if [ -d "apps/websocket-server" ]; then
    create_jest_config "apps/websocket-server" "websocket-server"
    create_jest_setup "apps/websocket-server" "WebSocket Server"
    create_sample_test "apps/websocket-server" "WebSocket Server"
fi

# Setup services
log_info "Setting up tests for services..."

for service in services/*; do
    if [ -d "$service" ]; then
        service_name=$(basename "$service")
        display_name=$(echo "$service_name" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')
        
        create_jest_config "$service" "$service_name"
        create_jest_setup "$service" "$display_name"
        create_sample_test "$service" "$display_name"
    fi
done

# Setup packages
log_info "Setting up tests for packages..."

for package in packages/*; do
    if [ -d "$package" ]; then
        package_name=$(basename "$package")
        display_name=$(echo "$package_name" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')
        
        create_jest_config "$package" "$package_name"
        create_jest_setup "$package" "$display_name"
        create_sample_test "$package" "$display_name"
    fi
done

echo ""
log_success "Test setup complete! 🎉"
echo ""
log_info "Next steps:"
echo "  1. Run 'pnpm test' to run all tests"
echo "  2. Run 'pnpm test:coverage' to check coverage"
echo "  3. Write actual tests in src/__tests__/ directories"
echo ""
