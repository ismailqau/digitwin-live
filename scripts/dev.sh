#!/bin/bash

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${BLUE}🚀 Starting DigitWin Live Development Servers...${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Copying from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}📝 Please update .env with your credentials before continuing.${NC}"
    exit 1
fi

# Function to print service summary
print_service_summary() {
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}  ✅ DigitWin Live Services Started Successfully${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BOLD}  Running Services:${NC}"
    echo ""
    echo -e "  ${CYAN}API Gateway${NC}              → ${BOLD}http://localhost:3000${NC}"
    echo -e "                             REST API + Swagger docs at /docs"
    echo ""
    echo -e "  ${CYAN}WebSocket Server${NC}         → ${BOLD}http://localhost:3001${NC}"
    echo -e "                             Real-time communication"
    echo ""
    echo -e "  ${CYAN}Face Processing Service${NC}  → ${BOLD}http://localhost:3006${NC}"
    echo -e "                             Face detection & embedding"
    echo ""
    echo -e "${BOLD}  Library Services (no HTTP server):${NC}"
    echo ""
    echo -e "  ${CYAN}RAG Service${NC}              → Knowledge retrieval (pgvector)"
    echo -e "  ${CYAN}LLM Service${NC}              → Language model integration"
    echo -e "  ${CYAN}ASR Service${NC}              → Speech-to-text (Google Chirp)"
    echo -e "  ${CYAN}TTS Service${NC}              → Text-to-speech (voice cloning)"
    echo -e "  ${CYAN}Lipsync Service${NC}          → Video lip synchronization"
    echo -e "  ${CYAN}Event Bus${NC}                → Pub/Sub event handling"
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BOLD}Quick Links:${NC}"
    echo -e "    • API Docs:    ${BLUE}http://localhost:3000/docs${NC}"
    echo -e "    • Health:      ${BLUE}http://localhost:3000/health${NC}"
    echo -e "    • Health:      ${BLUE}http://localhost:3001/health${NC}"
    echo -e "    • Face API:    ${BLUE}http://localhost:3006/health${NC}"
    echo ""
    echo -e "  ${BOLD}Commands:${NC}"
    echo -e "    • Stop:        ${YELLOW}Ctrl+C${NC}"
    echo -e "    • Tests:       ${YELLOW}pnpm test${NC}"
    echo -e "    • Build:       ${YELLOW}pnpm build${NC}"
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Function to print clean shutdown message
print_shutdown_summary() {
    echo ""
    echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}${BOLD}  🛑 Shutting Down Services...${NC}"
    echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Track child processes
TURBO_PID=""
SUMMARY_PID=""

# Cleanup function for graceful shutdown
cleanup() {
    print_shutdown_summary
    
    # Kill the summary background process if running
    if [ -n "$SUMMARY_PID" ] && kill -0 "$SUMMARY_PID" 2>/dev/null; then
        kill "$SUMMARY_PID" 2>/dev/null || true
    fi
    
    # Send SIGTERM to turbo process group
    if [ -n "$TURBO_PID" ] && kill -0 "$TURBO_PID" 2>/dev/null; then
        kill -TERM "$TURBO_PID" 2>/dev/null || true
        
        # Wait briefly for graceful shutdown
        sleep 1
        
        # Force kill if still running
        if kill -0 "$TURBO_PID" 2>/dev/null; then
            kill -9 "$TURBO_PID" 2>/dev/null || true
        fi
    fi
    
    echo -e "  ${GREEN}✓${NC} API Gateway"
    echo -e "  ${GREEN}✓${NC} WebSocket Server"
    echo -e "  ${GREEN}✓${NC} Face Processing Service"
    echo -e "  ${GREEN}✓${NC} RAG Service"
    echo ""
    echo -e "${GREEN}${BOLD}  ✅ All services stopped${NC}"
    echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Export the function so it can be called
export -f print_service_summary

# Start all services and print summary after a delay
(
    sleep 8  # Wait for services to start
    print_service_summary
) &
SUMMARY_PID=$!

# Start all services in development mode (suppress noisy output on shutdown)
pnpm turbo run dev --parallel 2>&1 | grep -v -E "(SIGINT|SIGTERM|shutting down|Server closed|Force killing|exited|Finishing writing)" &
TURBO_PID=$!

# Wait for turbo to finish
wait $TURBO_PID 2>/dev/null || true
