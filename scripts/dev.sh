#!/usr/bin/env bash

# DigiTwin Live Development Server Startup Script
# Cross-platform compatible with improved error handling

set -euo pipefail

# Detect OS for cross-platform compatibility
OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM=Linux;;
    Darwin*)    PLATFORM=Mac;;
    CYGWIN*)    PLATFORM=Cygwin;;
    MINGW*)     PLATFORM=MinGw;;
    MSYS*)      PLATFORM=Git-Bash;;
    *)          PLATFORM="UNKNOWN:${OS}"
esac

# Detect if running in Windows environment
IS_WINDOWS=0
if [[ "$PLATFORM" == "Cygwin" ]] || [[ "$PLATFORM" == "MinGw" ]] || [[ "$PLATFORM" == "Git-Bash" ]]; then
    IS_WINDOWS=1
fi

# Colors (with fallback for non-color terminals)
if [ -t 1 ]; then
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    YELLOW='\033[1;33m'
    CYAN='\033[0;36m'
    RED='\033[0;31m'
    NC='\033[0m'
    BOLD='\033[1m'
else
    GREEN=''
    BLUE=''
    YELLOW=''
    CYAN=''
    RED=''
    NC=''
    BOLD=''
fi

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

log_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Error handler
handle_error() {
    local exit_code=$?
    local line_number=$1
    local command="${BASH_COMMAND}"
    
    log_header "❌ Startup Failed"
    log_error "Error occurred at line ${line_number}"
    log_error "Exit code: ${exit_code}"
    log_error "Failed command: ${command}"
    echo ""
    
    # Provide context-specific troubleshooting
    log_info "Common causes and solutions:"
    echo ""
    
    if [[ "$command" == *"pnpm"* ]]; then
        echo "  ${BOLD}pnpm command failed:${NC}"
        echo "    • Ensure pnpm is installed: npm install -g pnpm"
        echo "    • Try: rm -rf node_modules && pnpm install"
        echo "    • Check pnpm version: pnpm --version (need 8+)"
    elif [[ "$command" == *"curl"* ]] || [[ "$exit_code" -eq 1 ]] && [[ "$line_number" -gt 200 ]]; then
        echo "  ${BOLD}Service health check failed:${NC}"
        echo "    • Services may have crashed during startup"
        echo "    • Check for port conflicts: lsof -i :3000"
        echo "    • Review error logs above for crash details"
        echo "    • Try: pnpm build to ensure code compiles"
    elif [[ -z "${DATABASE_URL:-}" ]]; then
        echo "  ${BOLD}Database configuration issue:${NC}"
        echo "    • DATABASE_URL not set in .env"
        echo "    • Copy .env.example to .env and configure"
        echo "    • Verify database is running and accessible"
    else
        echo "  ${BOLD}General troubleshooting:${NC}"
        echo "    1. Check if all dependencies are installed: pnpm install"
        echo "    2. Verify .env file exists and is configured"
        echo "    3. Check if ports 3000, 3001, 3006 are available"
        echo "    4. Review logs above for specific errors"
        echo "    5. Try: pnpm build && pnpm dev"
        echo "    6. See TROUBLESHOOTING.md for more help"
    fi
    echo ""
    
    cleanup
    exit ${exit_code}
}

trap 'handle_error ${LINENO}' ERR

# Track child processes
TURBO_PID=""
SUMMARY_PID=""
HEALTH_CHECK_PID=""
SERVICES_STARTED=0

# Cleanup function for graceful shutdown
cleanup() {
    # Only show shutdown messages if services were actually started
    if [ $SERVICES_STARTED -eq 1 ]; then
        log_header "🛑 Shutting Down Services"
    fi
    
    # Kill background processes
    for pid in "$SUMMARY_PID" "$HEALTH_CHECK_PID"; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done
    
    # Send SIGTERM to turbo process group
    if [ -n "$TURBO_PID" ] && kill -0 "$TURBO_PID" 2>/dev/null; then
        kill -TERM "$TURBO_PID" 2>/dev/null || true
        
        # Wait briefly for graceful shutdown
        sleep 2
        
        # Force kill if still running
        if kill -0 "$TURBO_PID" 2>/dev/null; then
            kill -9 "$TURBO_PID" 2>/dev/null || true
        fi
    fi
    
    # Only show success messages if services were started
    if [ $SERVICES_STARTED -eq 1 ]; then
        log_success "API Gateway stopped"
        log_success "WebSocket Server stopped"
        log_success "Face Processing Service stopped"
        log_success "RAG Service stopped"
        echo ""
        log_success "All services stopped cleanly"
        echo ""
    fi
}

trap cleanup SIGINT SIGTERM EXIT

# Pre-flight checks
preflight_checks() {
    log_header "🔍 Pre-flight Checks"
    
    local has_errors=0
    
    # Check Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        log_success "Node.js ${node_version}"
    else
        log_error "Node.js not found"
        has_errors=1
    fi
    
    # Check pnpm
    if command -v pnpm &> /dev/null; then
        local pnpm_version=$(pnpm --version)
        log_success "pnpm ${pnpm_version}"
    else
        log_error "pnpm not found - install with: npm install -g pnpm"
        has_errors=1
    fi
    
    # Check .env file
    if [ -f .env ]; then
        log_success ".env file exists"
    else
        log_warning ".env file not found"
        if [ -f .env.example ]; then
            log_info "Copying .env.example to .env..."
            cp .env.example .env
            log_warning "Please update .env with your credentials"
            has_errors=1
        else
            log_error ".env.example not found"
            has_errors=1
        fi
    fi
    
    # Check required environment variables
    if [ -f .env ]; then
        # Load .env without exiting on error
        set +e
        source .env 2>/dev/null
        set -e
        
        if [ -z "${DATABASE_URL:-}" ]; then
            log_error "DATABASE_URL not set in .env"
            log_info "  Add: DATABASE_URL=postgresql://user:pass@localhost:5432/dbname"
            has_errors=1
        else
            log_success "DATABASE_URL configured"
            
            # Try to verify database connection if psql is available
            if command -v psql &> /dev/null; then
                set +e
                psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1
                local db_status=$?
                set -e
                
                if [ $db_status -eq 0 ]; then
                    log_success "Database connection verified"
                else
                    log_warning "Cannot connect to database (check if PostgreSQL is running)"
                    log_info "  Test with: psql \$DATABASE_URL -c 'SELECT 1'"
                fi
            fi
        fi
        
        if [ -z "${OPENAI_API_KEY:-}" ]; then
            log_warning "OPENAI_API_KEY not set (RAG service may not work)"
        else
            log_success "OPENAI_API_KEY configured"
        fi
        
        # Check for other critical variables
        if [ -z "${JWT_SECRET:-}" ]; then
            log_warning "JWT_SECRET not set (authentication may not work)"
        fi
        
        if [ -z "${GCP_PROJECT_ID:-}" ]; then
            log_info "GCP_PROJECT_ID not set (ASR/TTS services may not work)"
        fi
    fi
    
    # Check if ports are available
    check_port() {
        local port=$1
        local service=$2
        local port_in_use=0
        
        # Try different methods based on platform
        if command -v lsof &> /dev/null && [ $IS_WINDOWS -eq 0 ]; then
            # macOS/Linux with lsof
            if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
                port_in_use=1
                local pid=$(lsof -Pi :${port} -sTCP:LISTEN -t 2>/dev/null | head -1)
                local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
                log_warning "Port ${port} (${service}) is in use by PID ${pid} (${process})"
                log_info "  To free it: kill -9 ${pid}"
            fi
        elif command -v netstat &> /dev/null; then
            # Cross-platform netstat
            if [ $IS_WINDOWS -eq 1 ]; then
                # Windows netstat format
                if netstat -ano | grep -q ":${port}.*LISTENING"; then
                    port_in_use=1
                    local pid=$(netstat -ano | grep ":${port}.*LISTENING" | awk '{print $5}' | head -1)
                    log_warning "Port ${port} (${service}) is in use by PID ${pid}"
                    log_info "  To free it: taskkill /PID ${pid} /F"
                fi
            else
                # Unix netstat format
                if netstat -an | grep -q ":${port}.*LISTEN"; then
                    port_in_use=1
                    log_warning "Port ${port} (${service}) is in use"
                fi
            fi
        elif command -v ss &> /dev/null; then
            # Linux ss command
            if ss -ln | grep -q ":${port}"; then
                port_in_use=1
                log_warning "Port ${port} (${service}) is in use"
            fi
        else
            log_info "Port ${port} (${service}) - cannot verify (no port checking tool found)"
            return 0
        fi
        
        if [ $port_in_use -eq 0 ]; then
            log_success "Port ${port} (${service}) is available"
            return 0
        else
            return 1
        fi
    }
    
    # Disable exit on error for port checks
    set +e
    local port_conflicts=0
    check_port 3000 "API Gateway" || port_conflicts=$((port_conflicts + 1))
    check_port 3001 "WebSocket Server" || port_conflicts=$((port_conflicts + 1))
    check_port 3006 "Face Processing" || port_conflicts=$((port_conflicts + 1))
    set -e
    
    if [ $port_conflicts -gt 0 ]; then
        echo ""
        log_error "Found ${port_conflicts} port conflict(s)"
        log_info "You can either:"
        echo "  1. Stop the processes using those ports (see commands above)"
        echo "  2. Continue anyway (services may fail to start)"
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Startup cancelled due to port conflicts"
            exit 1
        fi
    fi
    
    # Check if node_modules exists
    if [ -d node_modules ]; then
        log_success "Dependencies installed"
    else
        log_warning "node_modules not found - running pnpm install..."
        set +e
        pnpm install
        local install_status=$?
        set -e
        
        if [ $install_status -ne 0 ]; then
            log_error "Failed to install dependencies"
            has_errors=1
        fi
    fi
    
    # Check platform
    log_info "Platform: ${PLATFORM}"
    
    echo ""
    
    if [ $has_errors -eq 1 ]; then
        log_error "Pre-flight checks failed - please fix errors above"
        exit 1
    fi
    
    log_success "All pre-flight checks passed"
    echo ""
}

# Health check function
health_check() {
    local max_attempts=30
    local attempt=0
    local all_healthy=0
    local last_error=""
    
    log_info "Waiting for services to start..."
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        log_warning "curl not found - skipping health checks"
        log_info "Install curl to enable health checks"
        return 0
    fi
    
    while [ $attempt -lt $max_attempts ]; do
        sleep 1
        attempt=$((attempt + 1))
        
        # Check API Gateway with detailed error capture
        local health_response=$(curl -s -w "\n%{http_code}" http://localhost:3000/health 2>&1)
        local http_code=$(echo "$health_response" | tail -n1)
        local response_body=$(echo "$health_response" | head -n-1)
        
        if [ "$http_code" = "200" ]; then
            log_success "API Gateway is healthy (http://localhost:3000)"
            all_healthy=1
            break
        elif [ "$http_code" != "000" ] && [ "$http_code" != "" ]; then
            # Service is responding but not healthy
            last_error="HTTP ${http_code}: ${response_body}"
            log_warning "API Gateway returned ${http_code} (attempt ${attempt}/${max_attempts})"
        fi
        
        # Show progress every 5 seconds
        if [ $((attempt % 5)) -eq 0 ]; then
            log_info "Still waiting... (${attempt}/${max_attempts})"
            
            # Check if turbo process is still running
            if [ -n "$TURBO_PID" ] && ! kill -0 "$TURBO_PID" 2>/dev/null; then
                log_error "Turbo process has died unexpectedly"
                log_error "Check the logs above for crash details"
                return 1
            fi
        fi
    done
    
    if [ $all_healthy -eq 0 ]; then
        log_error "Services failed to start within ${max_attempts} seconds"
        
        if [ -n "$last_error" ]; then
            log_error "Last error: ${last_error}"
        fi
        
        echo ""
        log_info "Diagnostic information:"
        
        # Check if processes are listening on expected ports
        if command -v lsof &> /dev/null && [ $IS_WINDOWS -eq 0 ]; then
            echo "  Ports in use:"
            lsof -i :3000 -i :3001 -i :3006 2>/dev/null | grep LISTEN || echo "    No services listening on expected ports"
        elif command -v netstat &> /dev/null; then
            echo "  Ports in use:"
            netstat -an | grep -E ":(3000|3001|3006).*LISTEN" || echo "    No services listening on expected ports"
        fi
        
        echo ""
        log_error "Possible causes:"
        echo "  • Build errors preventing services from starting"
        echo "  • Database connection issues (check DATABASE_URL)"
        echo "  • Missing environment variables in .env"
        echo "  • Port conflicts (check if ports were freed)"
        echo "  • Dependency issues (try: pnpm install)"
        echo ""
        
        return 1
    fi
    
    # Check optional services (don't fail if they're not running)
    if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
        log_success "WebSocket Server is healthy (http://localhost:3001)"
    else
        log_info "WebSocket Server not running (optional)"
    fi
    
    if curl -s -f http://localhost:3006/health > /dev/null 2>&1; then
        log_success "Face Processing Service is healthy (http://localhost:3006)"
    else
        log_info "Face Processing Service not running (optional)"
    fi
    
    return 0
}

# Print service summary
print_service_summary() {
    log_header "✅ Services Started Successfully"
    
    echo -e "${BOLD}  Running Services:${NC}"
    echo ""
    echo -e "  ${CYAN}API Gateway${NC}              → ${BOLD}http://localhost:3000${NC}"
    echo -e "                             REST API + RAG Service"
    echo ""
    echo -e "  ${CYAN}WebSocket Server${NC}         → ${BOLD}http://localhost:3001${NC} ${YELLOW}(optional)${NC}"
    echo -e "                             Real-time communication"
    echo ""
    echo -e "  ${CYAN}Face Processing Service${NC}  → ${BOLD}http://localhost:3006${NC} ${YELLOW}(optional)${NC}"
    echo -e "                             Face detection & embedding"
    echo ""
    echo -e "${BOLD}  Integrated Services (no separate server):${NC}"
    echo ""
    echo -e "  ${CYAN}RAG Service${NC}              → Knowledge retrieval (PostgreSQL + pgvector)"
    echo -e "  ${CYAN}LLM Service${NC}              → Language model integration"
    echo -e "  ${CYAN}ASR Service${NC}              → Speech-to-text (Google Chirp)"
    echo -e "  ${CYAN}TTS Service${NC}              → Text-to-speech (voice cloning)"
    echo -e "  ${CYAN}Lipsync Service${NC}          → Video lip synchronization"
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BOLD}Quick Links:${NC}"
    echo -e "    • API Docs:    ${BLUE}http://localhost:3000/docs${NC}"
    echo -e "    • Health:      ${BLUE}http://localhost:3000/health${NC}"
    echo -e "    • RAG Search:  ${BLUE}http://localhost:3000/api/v1/rag/search${NC}"
    echo -e "    • RAG Stats:   ${BLUE}http://localhost:3000/api/v1/rag/stats${NC}"
    echo -e "    • WebSocket:   ${BLUE}http://localhost:3001/health${NC}"
    echo -e "    • Face API:    ${BLUE}http://localhost:3006/health${NC}"
    echo ""
    echo -e "  ${BOLD}Commands:${NC}"
    echo -e "    • Stop:        ${YELLOW}Ctrl+C${NC}"
    echo -e "    • Tests:       ${YELLOW}pnpm test${NC}"
    echo -e "    • Build:       ${YELLOW}pnpm build${NC}"
    echo -e "    • Verify:      ${YELLOW}./scripts/verify-services.sh${NC}"
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Main execution
main() {
    log_header "🚀 Starting DigiTwin Live Development Servers"
    
    # Run pre-flight checks
    preflight_checks
    
    log_info "Starting services..."
    echo ""
    
    # Create a temporary log file for capturing output
    local log_file=$(mktemp)
    
    # Mark that we're starting services
    SERVICES_STARTED=1
    
    # Start services in background with output capture
    (pnpm turbo run dev --parallel 2>&1 | tee "$log_file" | grep -v -E "(SIGINT|SIGTERM|shutting down|Server closed|Force killing|exited|Finishing writing)") &
    TURBO_PID=$!
    
    # Give services a moment to start
    sleep 2
    
    # Check if turbo process started successfully
    if ! kill -0 "$TURBO_PID" 2>/dev/null; then
        log_error "Failed to start turbo process"
        log_error "Recent output:"
        tail -n 20 "$log_file"
        rm -f "$log_file"
        exit 1
    fi
    
    # Wait for services to be healthy
    if health_check; then
        echo ""
        print_service_summary
        
        # Clean up log file
        rm -f "$log_file"
        
        # Keep script running and wait for turbo
        wait $TURBO_PID 2>/dev/null || true
    else
        log_error "Health check failed - services did not start properly"
        echo ""
        
        # Show recent logs from captured output
        log_info "Recent logs from startup:"
        echo ""
        tail -n 50 "$log_file" | sed 's/^/  /'
        echo ""
        
        # Clean up
        rm -f "$log_file"
        
        # Kill turbo process
        if [ -n "$TURBO_PID" ] && kill -0 "$TURBO_PID" 2>/dev/null; then
            kill -TERM "$TURBO_PID" 2>/dev/null || true
            sleep 1
            kill -9 "$TURBO_PID" 2>/dev/null || true
        fi
        
        log_info "For more help, see: TROUBLESHOOTING.md"
        exit 1
    fi
}

# Run main function
main
