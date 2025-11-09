#!/bin/bash

# Fix tsconfig.json files to exclude test files from build

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }

echo ""
log_info "Fixing tsconfig.json files to exclude test files..."
echo ""

# Find all tsconfig.json files in workspaces
for tsconfig in apps/*/tsconfig.json services/*/tsconfig.json packages/*/tsconfig.json; do
    if [ -f "$tsconfig" ]; then
        workspace=$(dirname "$tsconfig")
        
        # Check if exclude array exists and doesn't have test exclusions
        if grep -q '"exclude"' "$tsconfig"; then
            if ! grep -q '"\*\*/\*.test.ts"' "$tsconfig"; then
                log_info "Updating $tsconfig"
                
                # Use a temporary file for the update
                temp_file=$(mktemp)
                
                # Add test exclusions to existing exclude array
                sed 's/"exclude": \[/"exclude": [\n    "**\/*.test.ts",\n    "**\/*.spec.ts",\n    "**\/__tests__\/**",/' "$tsconfig" > "$temp_file"
                
                # Only update if sed succeeded
                if [ $? -eq 0 ]; then
                    mv "$temp_file" "$tsconfig"
                    log_success "Updated $workspace"
                else
                    rm "$temp_file"
                fi
            fi
        fi
    fi
done

echo ""
log_success "All tsconfig.json files updated!"
echo ""
log_info "Run 'pnpm build' to verify the fix"
echo ""
