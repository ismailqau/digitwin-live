# Implementation Plan: Qwen3-TTS Voice Cloning Integration

## Overview

Incremental implementation of the Qwen3-TTS integration: Python FastAPI service first, then TypeScript provider, shared types, mobile app voice-only mode, and finally Docker/Terraform infrastructure. Each step builds on the previous and includes property-based tests close to the implementation they validate.

## Tasks

- [x] 1. Create Qwen3-TTS Python service scaffold
  - [x] 1.1 Create `services/qwen3-tts-service/config.py` with environment variable configuration
    - Define `Config` class reading `PORT`, `HOST`, `MODEL_CACHE_DIR`, `CUSTOM_VOICE_MODEL`, `BASE_MODEL`, `TOKENIZER_MODEL`, `CUDA_VISIBLE_DEVICES`, `MAX_TEXT_LENGTH`, `GCS_MODEL_BUCKET`, `USE_VLLM` from `os.getenv` with defaults per design Data Models section
    - _Requirements: 1.6_
  - [x] 1.2 Create `services/qwen3-tts-service/models.py` with Pydantic request/response models
    - Define `SpeakerName` enum (9 timbres), `LanguageCode` enum (10 languages), `SynthesizeRequest`, `CloneRequest`, `SynthesizeResponse`, `StreamChunk`, `HealthResponse` per design Components section
    - _Requirements: 1.5, 2.3, 5.1_
  - [x] 1.3 Create `services/qwen3-tts-service/requirements.txt` and `requirements.gpu.txt`
    - Base: `fastapi`, `uvicorn`, `pydantic`, `soundfile`, `numpy`, `qwen-tts`
    - GPU: base + `torch` (CUDA), `flash-attn`, `vllm`
    - _Requirements: 1.3_

- [x] 2. Implement Qwen3-TTS service core logic
  - [x] 2.1 Create `services/qwen3-tts-service/service.py` with `Qwen3TTSService` class
    - Implement `initialize_models()` to load CustomVoice and Base models using `Qwen3TTSModel.from_pretrained()`, download and cache if not present
    - Implement `synthesize()` using `generate_custom_voice()` for premium timbre synthesis with optional style instruction
    - Implement `clone_voice()` using `generate_voice_clone()` from the Base model with audio sample input
    - Implement `validate_audio_sample()` to decode base64, detect format (WAV/MP3/FLAC), validate >= 3 second duration
    - Implement `get_gpu_info()` to return CUDA memory usage
    - _Requirements: 1.3, 1.4, 2.1, 2.2, 3.1, 3.2, 3.3_
  - [x] 2.2 Implement streaming generation in `Qwen3TTSService`
    - Add `synthesize_stream()` async generator method that yields `StreamChunk` objects with sequence numbers and `is_last` flag
    - Use the model's dual-track hybrid streaming capability
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 2.3 Create `services/qwen3-tts-service/main.py` with FastAPI app and routes
    - Define `/health`, `/ready`, `/synthesize`, `/clone`, `/synthesize/stream`, `/languages`, `/speakers` endpoints
    - Wire endpoints to `Qwen3TTSService` methods
    - Add CORS middleware, startup event for model loading
    - Return HTTP 503 with Retry-After header on GPU OOM errors
    - _Requirements: 1.1, 1.2, 2.4, 3.4, 4.4, 5.2, 5.4, 9.3_

- [x] 3. Checkpoint - Qwen3-TTS service core
  - Ensure all Python files have no syntax errors. Run `python -m py_compile` on each file. Ask the user if questions arise.

- [ ] 4. Add Python service tests
  - [ ]\* 4.1 Create `services/qwen3-tts-service/test_qwen3_tts.py` with unit tests
    - Test Pydantic model validation (valid/invalid payloads)
    - Test `validate_audio_sample()` with valid and invalid audio
    - Test health/ready endpoint responses
    - Test `/languages` and `/speakers` endpoints return correct data
    - _Requirements: 1.1, 1.2, 1.5, 3.3, 5.1, 5.4_
  - [ ]\* 4.2 Write property test: Invalid input rejection
    - **Property 1: Invalid input rejection**
    - Generate random invalid payloads (missing fields, wrong types, out-of-range values) using `hypothesis` and verify HTTP 422 with non-empty error
    - **Validates: Requirements 1.5**
  - [ ]\* 4.3 Write property test: Invalid timbre rejection
    - **Property 2: Invalid timbre rejection**
    - Generate random strings not in `SpeakerName` enum using `hypothesis` and verify rejection with valid names listed
    - **Validates: Requirements 2.5**
  - [ ]\* 4.4 Write property test: Invalid language rejection
    - **Property 3: Invalid language rejection**
    - Generate random strings not in `LanguageCode` enum using `hypothesis` and verify rejection with supported codes listed
    - **Validates: Requirements 5.3**
  - [ ]\* 4.5 Write property test: Short audio sample rejection
    - **Property 6: Short audio sample rejection**
    - Generate random audio samples with duration < 3 seconds using `hypothesis` and verify HTTP 400 with minimum duration message
    - **Validates: Requirements 3.2**

- [x] 5. Add QWEN3_TTS to shared types and create Qwen3TTS provider
  - [x] 5.1 Add `QWEN3_TTS = 'qwen3-tts'` to `TTSProvider` enum in `packages/shared-types/src/ai-providers.ts`
    - _Requirements: 6.6_
  - [x] 5.2 Create `services/tts-service/src/providers/Qwen3TTSProvider.ts`
    - Extend `BaseProvider`, implement `ITTSProvider` interface
    - Implement `initialize()` to verify connectivity via `/health` endpoint
    - Implement `synthesize()` with routing logic: `qwen3-{timbre}` → `/synthesize`, `qwen3-clone-{userId}` → `/clone`
    - Implement `synthesizeStream()` to consume chunked HTTP response and yield `TTSStreamChunk` objects
    - Implement `getAvailableVoices()` to return premium timbre IDs and language IDs
    - Implement `healthCheck()`, `estimateCost()`, `getMetrics()`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 5.3 Implement circuit breaker in `Qwen3TTSProvider`
    - Track consecutive failures, enter cooldown after `maxConsecutiveFailures` (default 3)
    - Set `isAvailable = false` during cooldown, attempt re-initialization after `cooldownPeriodMs` (default 30s)
    - _Requirements: 9.1, 9.2, 9.4_
  - [x] 5.4 Register `Qwen3TTSProvider` in `TTSService.initializeProviders()`
    - Add Qwen3TTS to the provider map in `services/tts-service/src/services/TTSService.ts`
    - _Requirements: 6.1_

- [ ] 6. Add TypeScript provider tests
  - [ ]\* 6.1 Write unit tests for `Qwen3TTSProvider` in `services/tts-service/src/__tests__/Qwen3TTSProvider.test.ts`
    - Test initialization with mock health endpoint (up/down)
    - Test `getAvailableVoices()` returns all timbres and languages
    - Test `estimateCost()` calculation
    - Test fallback when service unreachable
    - _Requirements: 6.1, 6.2, 9.1_
  - [ ]\* 6.2 Write property test: Voice model ID routing
    - **Property 9: Voice model ID routing**
    - Generate random voiceModelIds matching `qwen3-{timbre}` and `qwen3-clone-{id}` patterns using `fast-check` and verify correct endpoint routing
    - **Validates: Requirements 6.3, 6.4**
  - [ ]\* 6.3 Write property test: Circuit breaker activation
    - **Property 11: Circuit breaker activation**
    - Generate random sequences of success/failure results using `fast-check` and verify the provider enters cooldown after N consecutive failures
    - **Validates: Requirements 9.4**
  - [ ]\* 6.4 Write property test: Failed request error propagation
    - **Property 12: Failed request error propagation**
    - Generate random error responses using `fast-check` and verify the provider returns descriptive errors containing original context
    - **Validates: Requirements 9.2**

- [x] 7. Checkpoint - Provider integration
  - Ensure all TypeScript compiles (`pnpm --filter tts-service type-check`) and tests pass. Ask the user if questions arise.

- [x] 8. Implement voice-only conversation mode in mobile app
  - [x] 8.1 Create `apps/mobile-app/src/screens/conversation/VoiceOnlyConversationScreen.tsx`
    - Audio-only conversation UI with no video/face animation components
    - Integrate with existing WebSocket conversation flow for audio streaming
    - Display audio waveform indicator when AI is speaking
    - _Requirements: 8.2, 8.3, 8.5_
  - [x] 8.2 Create `apps/mobile-app/src/components/audio/AudioWaveform.tsx`
    - Animated waveform visualization component
    - Accept `isPlaying` prop to show/hide animation
    - _Requirements: 8.5_
  - [x] 8.3 Update conversation start flow to check face model availability
    - If user has no active face model → default to Voice_Only_Mode
    - If user has active face model → present choice between video and voice-only
    - Add navigation route for `VoiceOnlyConversationScreen`
    - _Requirements: 8.1, 8.4_
  - [ ]\* 8.4 Write property test: Conversation mode selection
    - **Property 10: Conversation mode selection based on face model**
    - Generate random user states (with/without active face model) using `fast-check` and verify correct mode options are presented
    - **Validates: Requirements 8.1, 8.4**

- [x] 9. Checkpoint - Mobile app voice-only mode
  - Ensure mobile app compiles and tests pass. Ask the user if questions arise.

- [x] 10. Create Docker and Terraform infrastructure
  - [x] 10.1 Create `services/qwen3-tts-service/Dockerfile` (GPU production)
    - Base: `nvidia/cuda:12.1-devel-ubuntu22.04`
    - Install Python 3.12, `qwen-tts`, FlashAttention 2, vLLM
    - Health check on `/health`, expose port 8001
    - Startup script to sync models from GCS if `GCS_MODEL_BUCKET` is set
    - _Requirements: 7.1_
  - [x] 10.2 Create `services/qwen3-tts-service/Dockerfile.cpu` and `docker-compose.yml`
    - CPU Dockerfile based on `python:3.12-slim` for local dev
    - docker-compose with optional GPU passthrough, model cache volume, env vars
    - _Requirements: 7.2_
  - [x] 10.3 Create `infrastructure/terraform/modules/qwen3-tts/main.tf`
    - Cloud Run service with NVIDIA L4 GPU (production: `g2-standard-8`, 32 GB RAM)
    - Dev/staging variant with NVIDIA T4 (`n1-standard-4`, 16 GB RAM)
    - GCS bucket for model weight caching
    - IAM service account with `storage.objectViewer`
    - Health check on `/ready` with 120s initial delay
    - Environment variables from `GPU_CONFIGS` in design
    - _Requirements: 7.3, 7.4, 7.5, 7.6_

- [x] 11. Final checkpoint
  - Ensure all tests pass across Python service, TypeScript provider, and mobile app. Verify Docker builds succeed. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `hypothesis` (Python) and `fast-check` (TypeScript), minimum 100 iterations each
- Checkpoints ensure incremental validation at natural break points
- The Python service follows the same pattern as the existing `xtts-service`
- The TypeScript provider follows the same pattern as the existing `XTTSProvider`
