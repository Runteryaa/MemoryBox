import { useEffect } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { Caveat_500Medium, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Fraunces_400Regular, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  ReducedMotionConfig,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorFallback } from '@/components/AppErrorFallback';
import { StreakCelebrationOverlay } from '@/components/StreakCelebrationOverlay';
import { UndoToast } from '@/components/UndoToast';
import { pruneOrphanedImages } from '@/services/fileStorage';
import { handlePendingImagePickerResult } from '@/services/pendingCapture';
import { useMemoryStore } from '@/store/useMemoryStore';
import { hydrateSettings, useSettingsStore } from '@/store/useSettingsStore';
import { fonts, useTheme } from '@/theme';

export const unstable_settings = {
  anchor: '(tabs)',
  screenErrorBoundary: AppErrorFallback,
};

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <AppErrorFallback {...props} />;
}

export default function RootLayout() {
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
    Caveat_500Medium,
    Caveat_700Bold,
    Fraunces_400Regular,
    Fraunces_600SemiBold,
  });

  const hasHydrated = useMemoryStore((state) => state.hasHydrated);
  const settingsHydrated = useSettingsStore((state) => state.hasHydrated);
  const evaluateStreak = useMemoryStore((state) => state.evaluateStreak);
  const pendingCelebration = useMemoryStore((state) => state.pendingCelebration);
  const clearCelebration = useMemoryStore((state) => state.clearCelebration);

  useEffect(() => {
    void hydrateSettings();
  }, []);

  useEffect(() => {
    if (hasHydrated) void handlePendingImagePickerResult();
  }, [hasHydrated]);

  // Once the box has loaded, clear out any photo file that no memory points to
  // (an abandoned capture, or one lost when the app was killed mid-save).
  useEffect(() => {
    if (!hasHydrated) return;
    const { memories } = useMemoryStore.getState();
    // An empty box could also mean hydration failed, so never sweep on nothing.
    if (memories.length === 0) return;
    try {
      pruneOrphanedImages(memories.map((memory) => memory.imageUri));
    } catch {
      // Housekeeping must never interrupt opening the app.
    }
  }, [hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    evaluateStreak();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') evaluateStreak();
    });
    return () => subscription.remove();
  }, [evaluateStreak, hasHydrated]);

  if ((!fontsLoaded && !fontError) || !hasHydrated || !settingsHydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <LoadingMark />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Honour the system "reduce motion" preference: the ambient loops calm
          down instead of fighting a setting the person explicitly chose. */}
      <ReducedMotionConfig mode={ReduceMotion.System} />
      <SafeAreaProvider>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: theme.colors.background },
            headerShown: false,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="capture"
            options={{
              animation: 'slide_from_bottom',
              gestureEnabled: false,
              presentation: 'fullScreenModal',
            }}
          />
        </Stack>
        <StreakCelebrationOverlay
          onClose={clearCelebration}
          streak={pendingCelebration}
        />
        <UndoToast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function LoadingMark() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const breathe = useSharedValue(0.92);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    // The opening beat should feel alive, but never insist on it.
    if (reducedMotion) {
      breathe.value = 1;
      shimmer.value = 0;
      return;
    }
    breathe.value = withRepeat(withTiming(1.06, { duration: 1500 }), -1, true);
    shimmer.value = withRepeat(
      withTiming(1, { duration: 2100, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
  }, [breathe, reducedMotion, shimmer]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -80 + shimmer.value * 200 }, { rotate: '18deg' }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(500)} style={styles.loadingInner}>
      <Animated.View style={[style, styles.loadingBox, { backgroundColor: theme.colors.boxBase }]}>
        <View style={[styles.loadingLid, { backgroundColor: theme.colors.rose }]} />
        <View style={[styles.loadingRibbon, { backgroundColor: theme.colors.ribbon }]} />
        <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerStyle]} />
      </Animated.View>
      <Text style={[styles.loadingText, { color: theme.colors.ink }]}>Memory Box</Text>
      <Text style={[styles.loadingHint, { color: theme.colors.muted }]}>
        dusting off the keepsakes…
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingInner: {
    alignItems: 'center',
  },
  loadingBox: {
    borderRadius: 18,
    height: 74,
    marginBottom: 20,
    overflow: 'hidden',
    width: 92,
  },
  loadingLid: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    height: 22,
    opacity: 0.9,
    width: '100%',
  },
  loadingRibbon: {
    height: '100%',
    left: '44%',
    opacity: 0.85,
    position: 'absolute',
    width: 10,
  },
  shimmer: {
    backgroundColor: 'rgba(255,255,255,0.26)',
    borderRadius: 8,
    height: 140,
    position: 'absolute',
    top: -30,
    width: 20,
  },
  loadingText: {
    fontFamily: fonts.serif,
    fontSize: 26,
    letterSpacing: -0.6,
  },
  loadingHint: {
    fontFamily: fonts.hand,
    fontSize: 18,
    marginTop: 2,
  },
});
