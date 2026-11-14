import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  withGradient?: boolean;
}

export function Screen({
  children,
  edges = ['top'],
  style,
  contentStyle,
  withGradient = true,
}: ScreenProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const drift = useSharedValue(0);

  // Very slow ambience: the warm blobs breathe so the paper never feels static.
  // With motion reduced they settle into a fixed, still wash of colour.
  useEffect(() => {
    if (reducedMotion) {
      drift.value = 0;
      return;
    }
    drift.value = withRepeat(
      withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [drift, reducedMotion]);

  const topBlobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -drift.value * 12 },
      { translateY: drift.value * 10 },
      { scale: 1 + drift.value * 0.05 },
    ],
  }));

  const bottomBlobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * 16 },
      { translateY: -drift.value * 14 },
      { scale: 1.04 - drift.value * 0.06 },
    ],
  }));

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }, style]}>
      {withGradient ? (
        <LinearGradient
          colors={theme.gradients.screen}
          end={{ x: 1, y: 1 }}
          locations={[0, 0.55, 1]}
          pointerEvents="none"
          start={{ x: 0.15, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          styles.blobTop,
          { backgroundColor: theme.isDark ? 'rgba(244,114,182,0.07)' : 'rgba(244,114,182,0.1)' },
          topBlobStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blob,
          styles.blobBottom,
          { backgroundColor: theme.isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.09)' },
          bottomBlobStyle,
        ]}
      />
      <SafeAreaView edges={edges} style={[styles.safe, contentStyle]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobTop: {
    width: 260,
    height: 260,
    top: -110,
    right: -90,
  },
  blobBottom: {
    width: 320,
    height: 320,
    bottom: -150,
    left: -130,
  },
});
