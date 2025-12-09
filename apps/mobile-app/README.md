# DigiTwin Live - Mobile App

React Native mobile application for the DigiTwin Live conversational AI system.

## Overview

The mobile app provides the user interface for interacting with digital clones through voice conversations, managing knowledge bases, and creating personalized voice and face models.

## Features

### ✅ Implemented

- **Authentication Flow**
  - Splash screen with auto-login
  - Login with email/password
  - Registration with email verification
  - Forgot password flow
  - Biometric authentication (Face ID/Touch ID)
  - Secure token storage

- **Onboarding Flow**
  - Welcome screen with feature carousel
  - Permissions request (microphone, camera, photo library, notifications)
  - Personality setup with trait selection
  - Voice setup prompt
  - Face setup prompt
  - Onboarding completion

- **Voice Model Creation** ✅ NEW
  - Voice sample recording with guided prompts
  - Real-time quality feedback
  - Sample review and playback
  - Upload progress tracking
  - Training status monitoring
  - Voice model preview and activation
  - See [Voice Model Creation UI Documentation](./docs/VOICE-MODEL-CREATION-UI.md)

- **Core Services**
  - Audio recording and playback
  - WebSocket client with auto-reconnection
  - Secure storage for tokens
  - State management with Zustand

### 🚧 In Progress

- Main conversation screen
- Knowledge base management
- Face model creation UI
- Settings and profile screens

## Project Structure

```
apps/mobile-app/
├── src/
│   ├── components/          # Reusable UI components
│   ├── config/              # App configuration
│   ├── constants/           # App constants
│   ├── hooks/               # Custom React hooks
│   ├── navigation/          # React Navigation setup
│   ├── screens/             # Screen components
│   │   ├── auth/            # Authentication screens
│   │   ├── onboarding/      # Onboarding flow screens
│   │   └── voice/           # Voice model creation screens ✅ NEW
│   ├── services/            # Business logic services
│   ├── store/               # Zustand state management
│   ├── theme/               # Theme configuration
│   ├── types/               # TypeScript types
│   └── utils/               # Utility functions
├── docs/                    # Documentation
│   ├── ONBOARDING-STATUS.md
│   └── VOICE-MODEL-CREATION-UI.md  ✅ NEW
├── ios/                     # iOS native code
├── android/                 # Android native code
└── __tests__/               # Test files
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- iOS: Xcode 14+ and CocoaPods
- Android: Android Studio and JDK 11+

### Installation

```bash
# Install dependencies
pnpm install

# iOS: Install pods
cd ios && pod install && cd ..

# Start Metro bundler
pnpm start

# Run on iOS
pnpm ios

# Run on Android
pnpm android
```

## Development

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Type Checking

```bash
# Type check
pnpm type-check
```

### Linting

```bash
# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix
```

## Documentation

- [Onboarding Status](./docs/ONBOARDING-STATUS.md) - Onboarding flow implementation details
- [Voice Model Creation UI](./docs/VOICE-MODEL-CREATION-UI.md) - Voice model creation flow ✅ NEW

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript (strict mode)
- **Navigation**: React Navigation 6
- **State Management**: Zustand
- **Audio**: expo-audio
- **Networking**: WebSocket (socket.io-client)
- **Storage**: react-native-keychain (secure), AsyncStorage
- **Testing**: Jest + React Native Testing Library

## Key Dependencies

```json
{
  "@react-navigation/native": "^6.x",
  "@react-navigation/native-stack": "^6.x",
  "@react-navigation/bottom-tabs": "^6.x",
  "expo-audio": "^13.x",
  "expo-av": "^13.x",
  "react-native-keychain": "^8.x",
  "socket.io-client": "^4.x",
  "zustand": "^4.x"
}
```

## Environment Variables

Create `.env` files for different environments:

```bash
# .env.development
API_URL=http://localhost:3000
WEBSOCKET_URL=ws://localhost:3001

# .env.production
API_URL=https://api.digitwinlive.com
WEBSOCKET_URL=wss://ws.digitwinlive.com
```

## Navigation Structure

```
RootNavigator
├── AuthNavigator (Stack)
│   ├── Splash
│   ├── Login
│   ├── Register
│   ├── ForgotPassword
│   └── EmailVerification
├── OnboardingNavigator (Stack)
│   ├── Welcome
│   ├── Permissions
│   ├── PersonalitySetup
│   ├── VoiceSetupPrompt
│   ├── FaceSetupPrompt
│   └── OnboardingComplete
├── VoiceNavigator (Stack) ✅ NEW
│   ├── VoiceRecording
│   ├── VoiceSampleReview
│   ├── VoiceUpload
│   ├── VoiceTrainingStatus
│   └── VoicePreview
└── MainNavigator (Tabs)
    ├── Conversation
    ├── History
    ├── Knowledge
    └── Settings
```

## State Management

The app uses Zustand for state management with the following stores:

- `authStore` - Authentication state and user data
- `conversationStore` - Conversation state and history
- `recordingStore` - Voice recording state
- `settingsStore` - App settings and preferences
- `uiStore` - UI state (modals, loading, etc.)

## API Integration

The app communicates with the backend through:

1. **REST API** - For CRUD operations and data fetching
2. **WebSocket** - For real-time conversation and status updates

### WebSocket Events

```typescript
// Client → Server
- 'audio:chunk' - Stream audio chunks
- 'audio:end' - End of utterance
- 'conversation:interrupt' - Interrupt response

// Server → Client
- 'transcript:interim' - Interim transcript
- 'transcript:final' - Final transcript
- 'response:start' - Response generation started
- 'audio:chunk' - Audio response chunk
- 'video:frame' - Video frame
- 'response:end' - Response complete
- 'state:changed' - Conversation state changed
- 'error' - Error occurred
```

## Permissions

The app requires the following permissions:

### iOS (Info.plist)

- `NSMicrophoneUsageDescription` - For voice recording
- `NSCameraUsageDescription` - For face capture
- `NSPhotoLibraryUsageDescription` - For photo selection
- `NSFaceIDUsageDescription` - For biometric authentication

### Android (AndroidManifest.xml)

- `RECORD_AUDIO` - For voice recording
- `CAMERA` - For face capture
- `READ_EXTERNAL_STORAGE` - For photo selection
- `INTERNET` - For API communication
- `ACCESS_NETWORK_STATE` - For network monitoring

## Troubleshooting

### iOS Build Issues

```bash
# Clean build
cd ios && rm -rf Pods Podfile.lock && pod install && cd ..

# Clean Xcode derived data
rm -rf ~/Library/Developer/Xcode/DerivedData
```

### Android Build Issues

```bash
# Clean gradle
cd android && ./gradlew clean && cd ..

# Clear cache
rm -rf android/.gradle
```

### Metro Bundler Issues

```bash
# Clear cache
pnpm start --reset-cache
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

## License

Proprietary - All rights reserved
