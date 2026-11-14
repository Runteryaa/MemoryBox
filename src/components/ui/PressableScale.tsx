import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';

interface PressableScaleProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?:
    | 'tap'
    | 'soft'
    | 'medium'
    | 'heavy'
    | 'selection'
    | 'paperRustle'
    | 'success'
    | 'none';
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'image' | 'none';
  /** Lets toggles such as chips and sort pills announce whether they are on. */
  selected?: boolean;
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled = false,
  style,
  scaleTo = 0.95,
  haptic = 'tap',
  accessibilityLabel,
  accessibilityRole = 'button',
  selected,
  testID,
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const state =
    selected === undefined && !disabled ? undefined : { selected, disabled };

  return (
    <AnimatedPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={state}
      disabled={disabled}
      onLongPress={onLongPress}
      onPress={() => {
        if (haptic !== 'none') haptics[haptic]();
        onPress?.();
      }}
      onPressIn={() => {
        scale.value = withSpring(scaleTo, { damping: 16, stiffness: 320, mass: 0.5 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260, mass: 0.6 });
      }}
      style={[style, animatedStyle, disabled && styles.disabled]}
      testID={testID}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.45,
  },
});
