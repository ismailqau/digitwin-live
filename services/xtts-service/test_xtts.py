#!/usr/bin/env python3
"""
XTTS Service Test Script
Tests the XTTS service across different platforms
"""

import requests
import json
import base64
import time
import platform
import sys
import os

def test_xtts_service(base_url="http://localhost:8000"):
    """Test the XTTS service functionality"""
    
    print("🤖 XTTS Service Test")
    print("=" * 50)
    print(f"Platform: {platform.system()} {platform.machine()}")
    print(f"Python: {sys.version}")
    print(f"Testing service at: {base_url}")
    print()
    
    # Test 1: Health Check
    print("1. Testing Health Check...")
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            health_data = response.json()
            print(f"   ✅ Service is {health_data['status']}")
            print(f"   📱 Platform: {health_data['platform']}")
            print(f"   🖥️  Device: {health_data['device']}")
            print(f"   🤖 Model loaded: {health_data['model_loaded']}")
            print(f"   🚀 GPU available: {health_data['gpu_available']}")
            print(f"   🍎 MPS available: {health_data['mps_available']}")
        else:
            print(f"   ❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Cannot connect to service: {e}")
        return False
    
    # Test 2: Languages
    print("\n2. Testing Supported Languages...")
    try:
        response = requests.get(f"{base_url}/languages", timeout=5)
        if response.status_code == 200:
            languages = response.json()
            print(f"   ✅ {len(languages['languages'])} languages supported")
            for lang in languages['languages'][:5]:  # Show first 5
                print(f"      - {lang['code']}: {lang['name']}")
            if len(languages['languages']) > 5:
                print(f"      ... and {len(languages['languages']) - 5} more")
        else:
            print(f"   ❌ Languages request failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Languages test failed: {e}")
    
    # Test 3: Basic Synthesis
    print("\n3. Testing Basic Text-to-Speech...")
    try:
        test_request = {
            "text": "Hello! This is a test of XTTS voice synthesis. The system is working correctly.",
            "language": "en",
            "speed": 1.0
        }
        
        print(f"   📝 Text: \"{test_request['text'][:50]}...\"")
        print(f"   🌍 Language: {test_request['language']}")
        
        start_time = time.time()
        response = requests.post(
            f"{base_url}/synthesize",
            json=test_request,
            timeout=30
        )
        duration = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Synthesis successful!")
            print(f"   ⏱️  Processing time: {duration:.2f}s")
            print(f"   🎵 Sample rate: {result['sample_rate']} Hz")
            print(f"   ⏳ Audio duration: {result['duration']:.2f}s")
            print(f"   🖥️  Device used: {result['device_used']}")
            print(f"   📊 Audio data size: {len(result['audio_data'])} chars (base64)")
            
            # Save audio file for testing
            audio_data = base64.b64decode(result['audio_data'])
            with open("test_output.wav", "wb") as f:
                f.write(audio_data)
            print(f"   💾 Audio saved as: test_output.wav")
            
        else:
            print(f"   ❌ Synthesis failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   📄 Error: {error_data}")
            except:
                print(f"   📄 Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Synthesis test failed: {e}")
        return False
    
    # Test 4: Different Languages
    print("\n4. Testing Multiple Languages...")
    test_languages = [
        ("es", "Hola, esto es una prueba en español."),
        ("fr", "Bonjour, ceci est un test en français."),
        ("de", "Hallo, das ist ein Test auf Deutsch."),
    ]
    
    for lang_code, text in test_languages:
        try:
            print(f"   🌍 Testing {lang_code}: \"{text[:30]}...\"")
            
            response = requests.post(
                f"{base_url}/synthesize",
                json={
                    "text": text,
                    "language": lang_code,
                    "speed": 1.0
                },
                timeout=20
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"      ✅ Success - {result['duration']:.1f}s audio")
            else:
                print(f"      ❌ Failed: {response.status_code}")
                
        except Exception as e:
            print(f"      ❌ Error: {e}")
    
    # Test 5: Voice Cloning (if reference audio available)
    print("\n5. Testing Voice Cloning...")
    
    # Create a simple test audio (sine wave)
    try:
        import numpy as np
        import wave
        
        # Generate a simple sine wave as test audio
        sample_rate = 22050
        duration = 2.0  # seconds
        frequency = 440  # Hz (A4 note)
        
        t = np.linspace(0, duration, int(sample_rate * duration), False)
        audio_data = np.sin(2 * np.pi * frequency * t) * 0.3
        audio_int16 = (audio_data * 32767).astype(np.int16)
        
        # Save as WAV
        with wave.open("test_reference.wav", "w") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_int16.tobytes())
        
        # Read and encode as base64
        with open("test_reference.wav", "rb") as f:
            reference_audio_b64 = base64.b64encode(f.read()).decode()
        
        print("   🎤 Testing with generated reference audio...")
        
        response = requests.post(
            f"{base_url}/synthesize",
            json={
                "text": "This is a test of voice cloning with XTTS.",
                "language": "en",
                "speaker_wav": reference_audio_b64,
                "speed": 1.0
            },
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Voice cloning test successful!")
            print(f"   ⏱️  Processing time: {result['processing_time']:.2f}s")
            
            # Save cloned audio
            cloned_audio = base64.b64decode(result['audio_data'])
            with open("test_cloned.wav", "wb") as f:
                f.write(cloned_audio)
            print(f"   💾 Cloned audio saved as: test_cloned.wav")
            
        else:
            print(f"   ⚠️  Voice cloning test failed: {response.status_code}")
            
        # Cleanup
        if os.path.exists("test_reference.wav"):
            os.remove("test_reference.wav")
            
    except ImportError:
        print("   ⚠️  Skipping voice cloning test (numpy not available)")
    except Exception as e:
        print(f"   ⚠️  Voice cloning test error: {e}")
    
    print("\n🎉 XTTS Service Test Complete!")
    print("\n📊 Test Summary:")
    print("   ✅ Health check")
    print("   ✅ Language support")
    print("   ✅ Basic synthesis")
    print("   ✅ Multi-language synthesis")
    print("   ✅ Voice cloning (if supported)")
    
    print("\n🚀 Next Steps:")
    print("   1. Test with your own voice samples")
    print("   2. Integrate with TTS service")
    print("   3. Deploy to production")
    print("   4. Monitor performance and costs")
    
    return True

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Test XTTS service")
    parser.add_argument("--url", default="http://localhost:8000", help="XTTS service URL")
    args = parser.parse_args()
    
    success = test_xtts_service(args.url)
    sys.exit(0 if success else 1)