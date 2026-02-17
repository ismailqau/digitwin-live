# Requirements Document

## Introduction

This feature integrates the Qwen3-TTS-12Hz-1.7B-CustomVoice model into the existing real-time conversational AI monorepo for voice cloning and text-to-speech synthesis. The integration adds a new standalone Python/FastAPI service (`qwen3-tts-service`) following the same pattern as the existing `xtts-service`, a new Qwen3TTS provider in the TypeScript `tts-service`, and a voice-only conversation mode in the mobile app for users who do not have face cloning available. The service supports both premium voice timbres with instruction-based style control (CustomVoice model) and 3-second rapid voice cloning from user audio (Base model), with streaming generation for low-latency real-time conversations. Deployment targets GCP with GPU instances (NVIDIA T4/L4) using Docker, with optional vLLM for production throughput.

## Glossary

- **Qwen3_TTS_Service**: The standalone Python/FastAPI microservice that loads and serves the Qwen3-TTS models for inference
- **Qwen3TTS_Provider**: The TypeScript provider class in the `tts-service` that communicates with the Qwen3_TTS_Service over HTTP
- **TTS_Service**: The existing Node.js/Express TTS orchestration service that routes synthesis requests to providers
- **CustomVoice_Model**: The Qwen3-TTS-12Hz-1.7B-CustomVoice model that supports 9 premium voice timbres and instruction-based style control
- **Base_Model**: The Qwen3-TTS-12Hz-1.7B-Base model that supports 3-second rapid voice cloning from a user audio sample
- **Voice_Clone**: A synthesized voice created by the Base_Model from a short (minimum 3-second) audio sample of a target speaker
- **Premium_Timbre**: One of the 9 built-in voice timbres (Vivian, Serena, Uncle_Fu, Dylan, Eric, Ryan, Aiden, Ono_Anna, Sohee) provided by the CustomVoice_Model
- **Style_Instruction**: A natural language instruction that controls voice characteristics (e.g., pitch, speed, emotion) when using the CustomVoice_Model
- **Streaming_Generation**: Dual-track hybrid streaming mode that generates audio chunks incrementally for low-latency playback
- **Mobile_App**: The React Native mobile application used by end users
- **Voice_Only_Mode**: A conversation mode in the Mobile_App where only audio is used, without face animation or video

## Requirements

### Requirement 1: Qwen3-TTS Python Service Setup

**User Story:** As a developer, I want a standalone Python/FastAPI service that loads and serves the Qwen3-TTS models, so that the monorepo can use Qwen3-TTS for voice synthesis and cloning.

#### Acceptance Criteria

1. THE Qwen3_TTS_Service SHALL expose a `/health` endpoint that returns the service status, device type, model load state, and GPU availability
2. THE Qwen3_TTS_Service SHALL expose a `/ready` endpoint that returns a successful response only when the model is fully loaded and ready for inference
3. WHEN the Qwen3_TTS_Service starts, THE Qwen3_TTS_Service SHALL download and cache the CustomVoice_Model and the Qwen3-TTS-Tokenizer-12Hz if they are not already present in the local model cache directory
4. WHEN the Qwen3_TTS_Service starts, THE Qwen3_TTS_Service SHALL download and cache the Base_Model if it is not already present in the local model cache directory
5. THE Qwen3_TTS_Service SHALL validate all incoming request payloads using Pydantic models and return HTTP 422 with descriptive error messages for invalid input
6. THE Qwen3_TTS_Service SHALL use environment variables for all configuration values including model cache path, port, host, and GPU device index

### Requirement 2: Premium Voice Synthesis

**User Story:** As a user, I want to generate speech using high-quality premium voice timbres with style control, so that I can have natural-sounding conversations with distinct voice personalities.

#### Acceptance Criteria

1. WHEN a synthesis request specifies a Premium_Timbre name and text, THE Qwen3_TTS_Service SHALL generate audio using the CustomVoice_Model with that timbre
2. WHEN a synthesis request includes a Style_Instruction, THE Qwen3_TTS_Service SHALL apply the instruction to control voice characteristics during generation
3. THE Qwen3_TTS_Service SHALL support all 9 Premium_Timbre options: Vivian, Serena, Uncle_Fu, Dylan, Eric, Ryan, Aiden, Ono_Anna, and Sohee
4. THE Qwen3_TTS_Service SHALL return synthesized audio as base64-encoded WAV data along with sample rate, duration, and processing time metadata
5. IF a synthesis request specifies an unrecognized Premium_Timbre name, THEN THE Qwen3_TTS_Service SHALL return HTTP 400 with an error message listing the valid timbre names

### Requirement 3: Voice Cloning from Audio Sample

**User Story:** As a user, I want to clone a voice from a short audio recording, so that the system can speak in a voice that sounds like me or another target speaker.

#### Acceptance Criteria

1. WHEN a voice clone request provides a base64-encoded audio sample of at least 3 seconds and text, THE Qwen3_TTS_Service SHALL generate audio using the Base_Model that mimics the speaker in the sample
2. IF a voice clone request provides an audio sample shorter than 3 seconds, THEN THE Qwen3_TTS_Service SHALL return HTTP 400 with an error message indicating the minimum duration requirement
3. THE Qwen3_TTS_Service SHALL accept audio samples in WAV, MP3, and FLAC formats for voice cloning
4. WHEN a voice clone request is processed, THE Qwen3_TTS_Service SHALL return synthesized audio as base64-encoded WAV data along with sample rate, duration, and processing time metadata

### Requirement 4: Streaming Audio Generation

**User Story:** As a user, I want to receive synthesized audio in real time as it is generated, so that I experience low-latency conversations without waiting for the full audio to complete.

#### Acceptance Criteria

1. WHEN a synthesis request sets the streaming flag to true, THE Qwen3_TTS_Service SHALL return audio chunks incrementally via a chunked HTTP response
2. WHEN streaming, THE Qwen3_TTS_Service SHALL send each audio chunk as a base64-encoded segment with a sequence number and an is_last flag
3. WHEN streaming, THE Qwen3_TTS_Service SHALL deliver the first audio chunk within 500 milliseconds of receiving the request on a GPU-equipped instance
4. IF an error occurs during streaming generation, THEN THE Qwen3_TTS_Service SHALL send an error chunk with a descriptive message and close the stream

### Requirement 5: Multi-Language Support

**User Story:** As a user, I want to generate speech in multiple languages, so that I can have conversations in my preferred language.

#### Acceptance Criteria

1. THE Qwen3_TTS_Service SHALL support synthesis in all 10 languages: Chinese, English, Japanese, Korean, German, French, Russian, Portuguese, Spanish, and Italian
2. WHEN a synthesis request specifies a language code, THE Qwen3_TTS_Service SHALL generate audio in that language
3. IF a synthesis request specifies an unsupported language code, THEN THE Qwen3_TTS_Service SHALL return HTTP 400 with an error message listing the supported language codes
4. THE Qwen3_TTS_Service SHALL expose a `/languages` endpoint that returns the list of supported language codes and names

### Requirement 6: Qwen3TTS Provider Integration

**User Story:** As a developer, I want a Qwen3TTS provider in the TTS orchestration service, so that the existing provider selection and fallback mechanisms work with Qwen3-TTS.

#### Acceptance Criteria

1. THE Qwen3TTS_Provider SHALL implement the ITTSProvider interface including initialize, synthesize, synthesizeStream, getAvailableVoices, healthCheck, and getMetrics methods
2. WHEN the Qwen3TTS_Provider is initialized, THE Qwen3TTS_Provider SHALL verify connectivity to the Qwen3_TTS_Service by calling the `/health` endpoint
3. WHEN the Qwen3TTS_Provider receives a synthesize request with a voiceModelId referencing a Premium_Timbre, THE Qwen3TTS_Provider SHALL forward the request to the Qwen3_TTS_Service premium synthesis endpoint
4. WHEN the Qwen3TTS_Provider receives a synthesize request with a voiceModelId referencing a user voice clone, THE Qwen3TTS_Provider SHALL forward the request to the Qwen3_TTS_Service voice clone endpoint
5. WHEN the Qwen3TTS_Provider receives a synthesizeStream request, THE Qwen3TTS_Provider SHALL consume the chunked response from the Qwen3_TTS_Service and yield TTSStreamChunk objects
6. THE TTSProvider enum in `@clone/shared-types` SHALL include a `QWEN3_TTS = 'qwen3-tts'` value

### Requirement 7: Docker and GCP Deployment

**User Story:** As a DevOps engineer, I want Docker images and Terraform configuration for the Qwen3-TTS service, so that I can deploy it on GCP with GPU support.

#### Acceptance Criteria

1. THE Qwen3_TTS_Service SHALL have a Dockerfile based on `nvidia/cuda` that installs Python 3.12, the `qwen-tts` package, FlashAttention 2, and all dependencies
2. THE Qwen3_TTS_Service SHALL have a `docker-compose.yml` for local development with GPU passthrough and model cache volume mounting
3. THE Qwen3_TTS_Service SHALL have Terraform configuration for deploying to GCP Cloud Run with NVIDIA L4 GPU (production, g2-standard-8, 32 GB RAM) and NVIDIA T4 GPU (dev/staging, n1-standard-4, 16 GB RAM)
4. THE Terraform configuration SHALL configure model weight caching using a GCS bucket to avoid re-downloading on each container start
5. THE Terraform configuration SHALL set resource limits appropriate for the 1.7B parameter model: NVIDIA L4 with 24 GB VRAM and 32 GB system RAM for production, NVIDIA T4 with 16 GB VRAM and 16 GB system RAM for dev/staging
6. THE Terraform configuration SHALL configure Cloud Run health checks using the `/ready` endpoint with a 120-second initial delay to allow for model loading

### Requirement 8: Voice-Only Conversation Mode

**User Story:** As a user without face cloning set up, I want to have voice-only conversations, so that I can use the conversational AI features with just audio.

#### Acceptance Criteria

1. WHEN a user starts a conversation and has no active face model, THE Mobile_App SHALL offer Voice_Only_Mode as the default conversation option
2. WHEN Voice_Only_Mode is active, THE Mobile_App SHALL display an audio-focused conversation interface without video or face animation components
3. WHEN Voice_Only_Mode is active, THE Mobile_App SHALL stream synthesized audio responses to the user using the same TTS pipeline as video conversations
4. WHEN a user who has an active face model starts a conversation, THE Mobile_App SHALL allow the user to choose between video mode and Voice_Only_Mode
5. WHILE Voice_Only_Mode is active, THE Mobile_App SHALL display a visual audio waveform or indicator to show when the AI is speaking

### Requirement 9: Error Handling and Resilience

**User Story:** As a developer, I want robust error handling and fallback behavior, so that the system remains available when the Qwen3-TTS service encounters issues.

#### Acceptance Criteria

1. IF the Qwen3_TTS_Service is unreachable, THEN THE Qwen3TTS_Provider SHALL report itself as unavailable and THE TTS_Service SHALL fall back to the next available provider
2. IF a synthesis request to the Qwen3_TTS_Service fails, THEN THE Qwen3TTS_Provider SHALL log the error with request context and return a descriptive error to the TTS_Service
3. IF the Qwen3_TTS_Service GPU runs out of memory during inference, THEN THE Qwen3_TTS_Service SHALL return HTTP 503 with a retry-after header
4. WHEN the Qwen3TTS_Provider detects repeated failures (3 consecutive errors), THE Qwen3TTS_Provider SHALL mark itself as unavailable and attempt re-initialization after a configurable cooldown period
