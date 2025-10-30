#!/bin/bash
# Verify directory structure and .gitkeep files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Verifying Directory Structure"
echo "========================================="
echo ""

# Track failures
FAILURES=0
CHECKS=0

# Function to check if .gitkeep exists
check_gitkeep() {
  local dir=$1
  local description=$2
  
  ((CHECKS++))
  
  if [ -f "$dir/.gitkeep" ]; then
    echo -e "${GREEN}✓${NC} $description: $dir"
    return 0
  else
    echo -e "${RED}✗${NC} $description: $dir (MISSING)"
    ((FAILURES++))
    return 1
  fi
}

# Function to check if directory exists
check_directory() {
  local dir=$1
  local description=$2
  
  ((CHECKS++))
  
  if [ -d "$dir" ]; then
    echo -e "${GREEN}✓${NC} $description: $dir"
    return 0
  else
    echo -e "${RED}✗${NC} $description: $dir (MISSING)"
    ((FAILURES++))
    return 1
  fi
}

echo "1. Checking Infrastructure Directories..."
check_gitkeep "infrastructure/terraform" "Terraform root"
check_gitkeep "infrastructure/terraform/backends" "Terraform backends"
check_gitkeep "infrastructure/terraform/environments" "Terraform environments"
check_gitkeep "infrastructure/terraform/modules" "Terraform modules"
check_gitkeep "infrastructure/scripts" "Infrastructure scripts"
echo ""

echo "2. Checking Application Directories..."
check_gitkeep "apps/api-gateway/logs" "API Gateway logs"
check_gitkeep "apps/api-gateway/uploads" "API Gateway uploads"
check_gitkeep "apps/websocket-server/logs" "WebSocket server logs"
echo ""

echo "3. Checking Service Log Directories..."
check_gitkeep "services/asr-service/logs" "ASR service logs"
check_gitkeep "services/rag-service/logs" "RAG service logs"
check_gitkeep "services/llm-service/logs" "LLM service logs"
check_gitkeep "services/tts-service/logs" "TTS service logs"
check_gitkeep "services/lipsync-service/logs" "Lip-sync service logs"
check_gitkeep "services/face-processing-service/logs" "Face processing service logs"
echo ""

echo "4. Checking Service Cache/Temp Directories..."
check_gitkeep "services/tts-service/cache" "TTS service cache"
check_gitkeep "services/lipsync-service/cache" "Lip-sync service cache"
check_gitkeep "services/rag-service/cache" "RAG service cache"
check_gitkeep "services/face-processing-service/tmp" "Face processing temp"
echo ""

echo "5. Checking Critical Configuration Files..."
check_directory "infrastructure/terraform/backends" "Backends directory"
check_directory "infrastructure/terraform/environments" "Environments directory"
check_directory "infrastructure/terraform/modules" "Modules directory"
echo ""

echo "6. Verifying .gitignore Patterns..."
if grep -q "!logs/.gitkeep" .gitignore; then
  echo -e "${GREEN}✓${NC} .gitignore preserves logs/.gitkeep"
  ((CHECKS++))
else
  echo -e "${RED}✗${NC} .gitignore missing logs/.gitkeep pattern"
  ((FAILURES++))
  ((CHECKS++))
fi

if grep -q "!uploads/.gitkeep" .gitignore; then
  echo -e "${GREEN}✓${NC} .gitignore preserves uploads/.gitkeep"
  ((CHECKS++))
else
  echo -e "${RED}✗${NC} .gitignore missing uploads/.gitkeep pattern"
  ((FAILURES++))
  ((CHECKS++))
fi

if grep -q "!cache/.gitkeep" .gitignore; then
  echo -e "${GREEN}✓${NC} .gitignore preserves cache/.gitkeep"
  ((CHECKS++))
else
  echo -e "${RED}✗${NC} .gitignore missing cache/.gitkeep pattern"
  ((FAILURES++))
  ((CHECKS++))
fi
echo ""

# Summary
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo "Total checks: $CHECKS"
echo "Passed: $((CHECKS - FAILURES))"
echo "Failed: $FAILURES"
echo ""

if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}✓ All directory structure checks passed!${NC}"
  echo ""
  echo "Directory structure is properly preserved."
  exit 0
else
  echo -e "${RED}✗ $FAILURES check(s) failed${NC}"
  echo ""
  echo "To fix missing .gitkeep files:"
  echo "  1. Create the missing directory: mkdir -p <directory>"
  echo "  2. Add .gitkeep file: echo '# Description' > <directory>/.gitkeep"
  echo "  3. Commit the changes: git add <directory>/.gitkeep && git commit"
  echo ""
  echo "See infrastructure/DIRECTORY-STRUCTURE.md for details."
  exit 1
fi
