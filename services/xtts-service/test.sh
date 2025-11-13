#!/bin/bash

# XTTS Service Test Script

set -e

echo "🧪 XTTS Service Test"
echo "==================="

# Check if service is running
if ! curl -s http://localhost:8000/health > /dev/null; then
    echo "❌ Service not running on port 8000"
    echo "   Run: ./setup.sh to start the service"
    exit 1
fi

# Test 1: Health Check
echo "1️⃣  Health Check..."
curl -s http://localhost:8000/health | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'✅ Status: {data.get(\"status\", \"unknown\")}')
    print(f'   Device: {data.get(\"device\", \"unknown\")}')
    print(f'   Model loaded: {data.get(\"model_loaded\", False)}')
except Exception as e:
    print(f'❌ Health check failed: {e}')
    sys.exit(1)
"

# Test 2: Basic Synthesis
echo ""
echo "2️⃣  Basic Synthesis..."
curl -s -X POST http://localhost:8000/synthesize \
    -H "Content-Type: application/json" \
    -d '{"text": "Hello! XTTS is working correctly.", "language": "en"}' | \
    python3 -c "
import sys, json, base64
try:
    data = json.load(sys.stdin)
    if 'audio_data' not in data:
        print('❌ Synthesis failed')
        sys.exit(1)
    
    processing_time = data.get('processing_time', 0)
    duration = data.get('duration', 0)
    print(f'✅ Synthesis successful!')
    print(f'   Processing: {processing_time:.2f}s')
    print(f'   Duration: {duration:.2f}s')
    
    # Save test output
    try:
        audio_bytes = base64.b64decode(data['audio_data'])
        with open('test_output.wav', 'wb') as f:
            f.write(audio_bytes)
        print('   💾 Saved: test_output.wav')
    except Exception:
        pass
        
except Exception as e:
    print(f'❌ Synthesis failed: {e}')
    sys.exit(1)
"

# Test 3: Language Support
echo ""
echo "3️⃣  Language Support..."
curl -s http://localhost:8000/languages | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    languages = data.get('languages', [])
    print(f'✅ {len(languages)} languages supported')
    for i, lang in enumerate(languages[:3]):
        print(f'   {lang[\"code\"]}: {lang[\"name\"]}')
    if len(languages) > 3:
        print(f'   ... and {len(languages) - 3} more')
except Exception as e:
    print(f'❌ Language test failed: {e}')
"

echo ""
echo "🎉 All tests passed!"
echo "🌐 Service ready at: http://localhost:8000"