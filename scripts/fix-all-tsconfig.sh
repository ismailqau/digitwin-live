#!/bin/bash

# Fix all tsconfig.json files to exclude test files

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }

echo ""
log_info "Fixing all tsconfig.json files..."
echo ""

FIXED=0

# Find all tsconfig.json files in workspaces
for tsconfig in apps/*/tsconfig.json services/*/tsconfig.json packages/*/tsconfig.json; do
    if [ -f "$tsconfig" ]; then
        workspace=$(dirname "$tsconfig")
        
        # Check if it has an exclude array
        if grep -q '"exclude"' "$tsconfig"; then
            # Check if it already has test exclusions
            if ! grep -q '"\*\*/\*.test.ts"' "$tsconfig"; then
                log_info "Fixing $workspace/tsconfig.json"
                
                # Create updated content
                cat > "$tsconfig" << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts",
    "**/__tests__/**",
    "**/jest.config.js",
    "**/jest.setup.ts"
  ]
}
EOF
                log_success "Fixed $workspace"
                FIXED=$((FIXED + 1))
            fi
        fi
    fi
done

echo ""
log_success "Fixed $FIXED tsconfig.json files!"
echo ""
log_info "Run 'pnpm build' to verify"
echo ""
