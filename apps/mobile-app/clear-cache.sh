#!/bin/bash

# Clear all Expo and Metro caches

echo "🧹 Clearing Expo and Metro caches..."

# Kill any running Metro bundler
echo "Stopping Metro bundler..."
pkill -f "react-native" || true
pkill -f "metro" || true

# Clear Metro bundler cache
echo "Clearing Metro cache..."
rm -rf node_modules/.cache

# Clear Expo cache
echo "Clearing Expo cache..."
rm -rf .expo

# Clear watchman cache (if installed)
if command -v watchman &> /dev/null; then
    echo "Clearing Watchman cache..."
    watchman watch-del-all
fi

# Clear iOS build cache (if exists)
if [ -d "ios" ]; then
    echo "Clearing iOS build cache..."
    rm -rf ios/build
    rm -rf ios/Pods
fi

# Clear Android build cache (if exists)
if [ -d "android" ]; then
    echo "Clearing Android build cache..."
    rm -rf android/build
    rm -rf android/app/build
    rm -rf android/.gradle
fi

echo "✅ Cache cleared!"
echo ""
echo "Now run: npx expo start --clear"
