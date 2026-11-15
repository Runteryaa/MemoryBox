import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Undo2 } from 'lucide-react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { contrastInk, fonts, radii, shadows, useTheme } from '@/theme';
import { useMemoryStore } from '@/store/useMemoryStore';

const VISIBLE_MS = 8000;

/**
 * A memory is never really gone for the first few seconds — a small toast offers
 * to put it straight back into the box.
 */
export function UndoToast() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const trash = useMemoryStore((state) => state.trash);
  const restoreTrash = useMemoryStore((state) => state.restoreTrash);
  const dismissTrash = useMemoryStore((state) => state.dismissTrash);
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A thin line drains away, so the undo window is something you can see.
  const drain = useSharedValue(1);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!trash) {
      setVisible(false);
      return;
    }
    setVisible(true);
    // A toast that merely appears is invisible to a screen reader; say it out
    // loud so nobody loses a memory just because they could not see it.
    AccessibilityInfo.announceForAccessibility(
      `${trash.shortTitle} was let go. Undo is available for a few seconds.`
    );
    drain.value = 1;
    // A bar sliding away is exactly the kind of movement some readers ask not
    // to see, so they get a still line for the same window instead.
    if (!reducedMotion) {
      drain.value = withTiming(0, { duration: VISIBLE_MS, easing: Easing.linear });
    }
    timer.current = setTimeout(() => {
      setVisible(false);
      dismissTrash();
    }, VISIBLE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // dismissTrash is stable from the store; re-running on trash identity is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trash?.id]);

  const drainStyle = useAnimatedStyle(() => ({
    opacity: drain.value > 0.02 ? 0.75 : 0,
    transform: [{ scaleX: drain.value }],
  }));

  if (!trash || !visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16).stiffness(180)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + 178 }]}
    >
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            backgroundColor: theme.colors.ink,
            borderColor: theme.colors.borderStrong,
            shadowColor: theme.colors.shadow,
          },
          shadows.card,
        ]}
      >
        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.colors.background }]}>
            {trash.shortTitle}
          </Text>
          <Text style={[styles.hint, { color: theme.colors.faint }]}>letting go in a moment</Text>
        </View>
        <PressableScale
          accessibilityHint="Restores this memory to your box"
          accessibilityLabel="Put the memory back"
          haptic="success"
          onPress={() => {
            if (timer.current) clearTimeout(timer.current);
            restoreTrash();
            setVisible(false);
          }}
          style={[styles.button, { backgroundColor: theme.colors.rose }]}
        >
          <Undo2 color={contrastInk(theme.colors.rose)} size={13} strokeWidth={2.6} />
          <Text style={[styles.buttonText, { color: contrastInk(theme.colors.rose) }]}>Undo</Text>
        </PressableScale>
        <Animated.View
          pointerEvents="none"
          style={[styles.drain, { backgroundColor: theme.colors.rose }, drainStyle]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    left: 16,
    position: 'absolute',
    right: 16,
  },
  toast: {
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  drain: {
    bottom: 0,
    height: 2.5,
    left: 0,
    position: 'absolute',
    right: 0,
    transformOrigin: 'left',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    marginTop: 1,
  },
  button: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  buttonText: {
    fontFamily: fonts.sansBold,
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
});
