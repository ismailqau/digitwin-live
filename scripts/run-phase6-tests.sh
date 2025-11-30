#!/bin/bash

# Phase 6 Testing and Validation Script
# Runs all tests for ASR, RAG, LLM, TTS, Voice Cloning, and Integration

set -e

echo "🧪 Phase 6: Testing and Validation"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run tests for a service
run_service_tests() {
  local service=$1
  local service_path=$2
  
  echo -e "${BLUE}Testing ${service}...${NC}"
  
  if [ -d "$service_path" ]; then
    cd "$service_path"
    
    if pnpm test --run 2>&1 | tee /tmp/test_output.log; then
      echo -e "${GREEN}✓ ${service} tests passed${NC}"
      PASSED_TESTS=$((PASSED_TESTS + 1))
    else
      echo -e "${RED}✗ ${service} tests failed${NC}"
      FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    cd - > /dev/null
  else
    echo -e "${YELLOW}⚠ ${service} not found at ${service_path}${NC}"
  fi
  
  echo ""
}

# 1. ASR Service Tests
echo -e "${YELLOW}=== 1. ASR Service Testing ===${NC}"
run_service_tests "ASR Service" "services/asr-service"

# 2. RAG Service Tests
echo -e "${YELLOW}=== 2. RAG Pipeline Testing ===${NC}"
run_service_tests "RAG Service" "services/rag-service"

# 3. LLM Service Tests
echo -e "${YELLOW}=== 3. LLM Service Testing ===${NC}"
run_service_tests "LLM Service" "services/llm-service"

# 4. TTS Service Tests
echo -e "${YELLOW}=== 4. TTS Service Testing ===${NC}"
run_service_tests "TTS Service" "services/tts-service"

# 5. WebSocket Server Integration Tests
echo -e "${YELLOW}=== 5. Integration Testing ===${NC}"
run_service_tests "WebSocket Server" "apps/websocket-server"

# 6. Performance Tests
echo -e "${YELLOW}=== 6. Performance Testing ===${NC}"
if [ -f "scripts/test-performance.sh" ]; then
  if bash scripts/test-performance.sh; then
    echo -e "${GREEN}✓ Performance tests completed${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}✗ Performance tests failed${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
else
  echo -e "${YELLOW}⚠ Performance test script not found${NC}"
fi
echo ""

# 7. Manual Testing Checklist
echo -e "${YELLOW}=== 7. Manual Testing Checklist ===${NC}"
echo "Please complete the following manual tests:"
echo ""
echo "□ Test audio streaming with various audio qualities"
echo "□ Validate transcription accuracy with different accents"
echo "□ Test document upload (PDF, DOCX, TXT, HTML, Markdown)"
echo "□ Verify vector search accuracy and relevance"
echo "□ Test LLM response generation with different providers"
echo "□ Validate voice model training and quality"
echo "□ Test end-to-end conversation flow"
echo "□ Verify interruption handling"
echo "□ Test error recovery scenarios"
echo "□ Collect user feedback on quality"
echo ""

# Summary
echo -e "${BLUE}=== Test Summary ===${NC}"
echo "Total test suites: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✓ All automated tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Review test results in test-results/ directory"
  echo "2. Complete manual testing checklist above"
  echo "3. Collect user feedback"
  echo "4. Document any issues found"
  echo "5. Fix critical bugs before proceeding to Phase 7"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Please review and fix issues.${NC}"
  echo ""
  echo "Check test output above for details."
  exit 1
fi
