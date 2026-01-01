#!/bin/bash
set -e

echo "🧹 Cleaning React Native build artifacts..."

# Clean Watchman
watchman watch-del-all || true

# Clean Metro cache
rm -rf $TMPDIR/metro-* || true
rm -rf $TMPDIR/haste-map-* || true

# Clean Node modules (optional, but good for deep clean)
echo "📦 verifying node modules..."
# Force install without scripts to bypass flaky network issues (like grpc-tools)
pnpm install --ignore-scripts

# Clean iOS
echo "🍎 Cleaning iOS build..."
cd apps/mobile-app/ios
rm -rf build
rm -rf Pods
rm -rf Podfile.lock
pod install
cd ../../..

echo "🤖 Clearning Android build..."
cd apps/mobile-app/android
./gradlew clean
cd ../../..

echo "✨ Clean complete. Please rebuild your app now:"
echo "  Run: npx expo run:ios"
echo "  OR"
echo "  Run: npx expo run:android"
