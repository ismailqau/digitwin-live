/**
 * AudioWaveform Component
 *
 * Animated waveform visualization that indicates when the AI is speaking.
 * Shows animated bars when isPlaying is true, static bars otherwise.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const BAR_COUNT = 5;
const BAR_WIDTH = 4;
const BAR_GAP = 3;
const MIN_HEIGHT = 8;
const MAX_HEIGHT = 28;
const ANIMATION_DURATION = 400;

interface AudioWaveformProps {
  isPlaying: boolean;
  color?: string;
  size?: 'small' | 'medium' | 'large';
}

const SIZE_SCALE: Record<string, number> = {
  small: 0.7,
  medium: 1,
  large: 1.4,
};

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isPlaying,
  color = '#007AFF',
  size = 'medium',
}) => {
  const scale = SIZE_SCALE[size] ?? 1;
  const animations = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(MIN_HEIGHT * scale))
  ).current;

  useEffect(() => {
    if (isPlaying) {
      const loopAnimations = animations.map((anim, index) => {
        const targetHeight = MIN_HEIGHT * scale + Math.random() * (MAX_HEIGHT - MIN_HEIGHT) * scale;
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: targetHeight,
              duration: ANIMATION_DURATION + index * 80,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: MIN_HEIGHT * scale,
              duration: ANIMATION_DURATION + index * 80,
              useNativeDriver: false,
            }),
          ])
        );
      });
      loopAnimations.forEach((a) => a.start());
      return () => loopAnimations.forEach((a) => a.stop());
    } else {
      animations.forEach((anim) => {
        Animated.timing(anim, {
          toValue: MIN_HEIGHT * scale,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
      return undefined;
    }
  }, [isPlaying, animations, scale]);

  return (
    <View
      style={styles.container}
      accessibilityRole="image"
      accessibilityLabel={isPlaying ? 'AI is speaking' : 'AI is silent'}
    >
      {animations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              width: BAR_WIDTH * scale,
              marginHorizontal: (BAR_GAP * scale) / 2,
              height: anim,
              backgroundColor: color,
              borderRadius: (BAR_WIDTH * scale) / 2,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {},
});

export default AudioWaveform;
