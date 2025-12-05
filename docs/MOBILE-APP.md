# Mobile App Architecture

## Overview

The DigiTwin Live mobile app is built with React Native and provides the user interface for real-time conversations with AI-powered digital twins.

## Technology Stack

- **Framework**: React Native with Expo
- **Navigation**: React Navigation v7 (native-stack, bottom-tabs)
- **State Management**: Zustand with persistence
- **Styling**: React Native StyleSheet with theme system

## Project Structure

```
apps/mobile-app/
├── src/
│   ├── navigation/           # React Navigation setup
│   │   ├── RootNavigator.tsx     # Top-level navigator
│   │   ├── AuthNavigator.tsx     # Authentication flow
│   │   ├── OnboardingNavigator.tsx # Onboarding flow
│   │   └── MainNavigator.tsx     # Main app tabs
│   ├── screens/              # Screen components (to be implemented)
│   ├── components/           # Reusable UI components
│   ├── services/             # Business logic services
│   │   ├── AudioManager.ts       # Audio recording
│   │   ├── AudioPlaybackManager.ts # Audio playback
│   │   ├── ConversationManager.ts  # Conversation state
│   │   └── VoiceSampleManager.ts   # Voice sample handling
│   ├── hooks/                # Custom React hooks
│   ├── store/                # Zustand stores
│   │   ├── authStore.ts          # Authentication state
│   │   ├── uiStore.ts            # UI state (theme, loading)
│   │   ├── conversationStore.ts  # Conversation state
│   │   └── settingsStore.ts      # User settings
│   ├── theme/                # Theme configuration
│   │   ├── colors.ts             # Color palette
│   │   ├── spacing.ts            # Spacing system
│   │   └── typography.ts         # Typography styles
│   ├── constants/            # App constants
│   └── types/                # TypeScript types
├── ios/                      # iOS native code (to be configured)
├── android/                  # Android native code (to be configured)
└── __tests__/                # Test files
```

## Navigation Structure

### Auth Flow

```
Splash → Login → Register → ForgotPassword → EmailVerification
```

### Onboarding Flow

```
Welcome → Permissions → PersonalitySetup → VoiceSetup → FaceSetup → Complete
```

### Main App (Tab Navigator)

```
Conversation | History | Knowledge | Settings
```

## State Management

The app uses Zustand for state management with the following stores:

- **authStore**: Authentication state (user, tokens, onboarding status)
- **uiStore**: UI state (theme, loading, modals, toasts)
- **conversationStore**: Conversation state (session, turns, connection)
- **settingsStore**: User preferences (voice, AI, notifications)

## Commands

```bash
# Development
pnpm --filter @clone/mobile-app start    # Start Expo dev server
pnpm --filter @clone/mobile-app ios      # Run on iOS simulator
pnpm --filter @clone/mobile-app android  # Run on Android emulator

# Testing
pnpm --filter @clone/mobile-app test     # Run tests
pnpm --filter @clone/mobile-app type-check # Type check

# Building
pnpm --filter @clone/mobile-app build    # Type check (no emit)
```

## Environment Configuration

Environment variables are configured in:

- `.env.development` - Development settings
- `.env.staging` - Staging settings
- `.env.production` - Production settings

Key variables:

- `API_URL` - Backend API URL
- `WEBSOCKET_URL` - WebSocket server URL
- `ENVIRONMENT` - Current environment
- `DEBUG` - Debug mode flag

## Implementation Status

### ✅ Completed

- Navigation structure (React Navigation)
- State management (Zustand stores)
- Theme system (colors, spacing, typography)
- Audio services (recording, playback)
- Basic conversation screen
- Voice sample recording

### 🚧 In Progress

- Authentication screens
- Onboarding flow
- Face model creation UI

### ❌ Not Started

- Knowledge base management UI
- Settings screens
- WebSocket client integration
- Video player for lip-sync
- Push notifications
- Deep linking
