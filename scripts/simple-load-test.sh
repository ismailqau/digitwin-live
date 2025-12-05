#!/bin/bash

# Simple Load Test Script
# Tests API Gateway and WebSocket Server endpoints

set -e

API_URL="${API_URL:-http://localhost:3000}"
WEBSOCKET_URL="${WEBSOCKET_URL:-http://localhost:3001}"
CONCURRENT_USERS="${CONCURRENT_USERS:-10}"
REQUESTS_PER_USER="${REQUESTS_PER_USER:-50}"
TOTAL_REQUESTS=$((CONCURRENT_USERS * REQUESTS_PER_USER))

echo "=========================================="
echo "       SIMPLE LOAD TEST"
echo "=========================================="
echo "API Gateway URL: $API_URL"
echo "WebSocket URL: $WEBSOCKET_URL"
echo "Concurrent Users: $CONCURRENT_USERS"
echo "Requests per User: $REQUESTS_PER_USER"
echo "Total Requests: $TOTAL_REQUESTS"
echo "=========================================="
echo ""

# Create temp directory for results
RESULTS_DIR=$(mktemp -d)
trap "rm -rf $RESULTS_DIR" EXIT

# Function to run requests for a single user
run_user_requests() {
    local user_id=$1
    local results_file="$RESULTS_DIR/user_$user_id.txt"
    
    for i in $(seq 1 $REQUESTS_PER_USER); do
        # Alternate between different endpoints
        case $((i % 4)) in
            0)
                endpoint="$API_URL/health"
                ;;
            1)
                endpoint="$WEBSOCKET_URL/health"
                ;;
            2)
                endpoint="$API_URL/api/v1/voice/models"
                ;;
            3)
                endpoint="$API_URL/api/v1/documents"
                ;;
        esac
        
        # Make request and capture timing
        response=$(curl -s -o /dev/null -w "%{http_code},%{time_total}" "$endpoint" 2>/dev/null || echo "000,0")
        echo "$response" >> "$results_file"
    done
}

echo "Starting load test..."
START_TIME=$(date +%s.%N)

# Launch concurrent users
for user in $(seq 1 $CONCURRENT_USERS); do
    run_user_requests $user &
done

# Wait for all users to complete
wait

END_TIME=$(date +%s.%N)
DURATION=$(echo "$END_TIME - $START_TIME" | bc)

echo ""
echo "=========================================="
echo "       RESULTS"
echo "=========================================="

# Aggregate results
total_requests=0
successful_requests=0
failed_requests=0
total_time=0
min_time=999999
max_time=0

for file in $RESULTS_DIR/user_*.txt; do
    while IFS=',' read -r status time; do
        total_requests=$((total_requests + 1))
        
        # 2xx, 3xx, 401 (unauthorized), and 429 (rate limited) are considered valid responses
        if [[ "$status" =~ ^[23] ]] || [[ "$status" == "401" ]] || [[ "$status" == "429" ]]; then
            successful_requests=$((successful_requests + 1))
        else
            failed_requests=$((failed_requests + 1))
        fi
        
        # Convert time to milliseconds for easier comparison
        time_ms=$(echo "$time * 1000" | bc)
        total_time=$(echo "$total_time + $time_ms" | bc)
        
        if (( $(echo "$time_ms < $min_time" | bc -l) )); then
            min_time=$time_ms
        fi
        if (( $(echo "$time_ms > $max_time" | bc -l) )); then
            max_time=$time_ms
        fi
    done < "$file"
done

avg_time=$(echo "scale=2; $total_time / $total_requests" | bc)
requests_per_second=$(echo "scale=2; $total_requests / $DURATION" | bc)
error_rate=$(echo "scale=2; $failed_requests * 100 / $total_requests" | bc)

echo "Total Requests: $total_requests"
echo "Successful: $successful_requests"
echo "Failed: $failed_requests"
echo "Error Rate: ${error_rate}%"
echo ""
echo "Response Times:"
echo "  Min: ${min_time}ms"
echo "  Max: ${max_time}ms"
echo "  Avg: ${avg_time}ms"
echo ""
echo "Throughput: ${requests_per_second} req/s"
echo "Total Duration: ${DURATION}s"
echo "=========================================="

# Check thresholds
echo ""
echo "Threshold Checks:"
if (( $(echo "$avg_time < 100" | bc -l) )); then
    echo "  ✅ Average latency < 100ms"
else
    echo "  ❌ Average latency >= 100ms"
fi

if (( $(echo "$max_time < 2500" | bc -l) )); then
    echo "  ✅ Max latency < 2500ms (p95 target)"
else
    echo "  ❌ Max latency >= 2500ms"
fi

if (( $(echo "$error_rate < 10" | bc -l) )); then
    echo "  ✅ Error rate < 10%"
else
    echo "  ❌ Error rate >= 10%"
fi

echo ""
echo "Load test completed!"
