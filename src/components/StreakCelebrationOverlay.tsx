import { useEffect, type ComponentProps } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Sparkles } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeInDown,
  ZoomIn,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CelebrationConfetti } from '@/components/SkiaParticles';
import { CountUp } from '@/components/ui/CountUp';
import { PressableScale } from '@/components/ui/PressableScale';
import { haptics } from '@/lib/haptics';
import { contrastInk, fonts, radii, shadows, useTheme } from '@/theme';

interface StreakCelebrationOverlayProps {
  streak: number | null;
  onClose: () => void;
}

const MESSAGES = [
  'A little moment, kept forever.',
  'Your box is a bit fuller today.',
  'Something lovely to look back on.',
  'One more page in your story.',
  'This day is safe now.',
];

export function StreakCelebrationOverlay({ streak, onClose }: StreakCelebrationOverlayProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const visible = streak != null && streak > 0;
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!visible || reducedMotion) {
      drift.value = 0;
      return;
    }
    drift.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [drift, reducedMotion, visible]);

  const sparkleTopStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + drift.value * 0.45,
    transform: [
      { translateY: -drift.value * 8 },
      { rotate: `${drift.value * 24 - 12}deg` },
      { scale: 0.9 + drift.value * 0.2 },
    ],
  }));

  const sparkleBottomStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + (1 - drift.value) * 0.5,
    transform: [
      { translateY: -(1 - drift.value) * 6 },
      { rotate: `${12 - drift.value * 26}deg` },
      { scale: 0.88 + (1 - drift.value) * 0.22 },
    ],
  }));

  const message = MESSAGES[(Math.max(1, streak ?? 1) - 1) % MESSAGES.length] ?? MESSAGES[0];

  useEffect(() => {
    if (!visible) return;
    haptics.success();
    AccessibilityInfo.announceForAccessibility(
      `${streak ?? 0} ${streak === 1 ? 'day' : 'days'} in a row. ${message}.`
    );
  }, [message, streak, visible]);

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}>
        {visible ? <CelebrationConfetti count={40} /> : null}

        {/* Tapping the quiet space around the card lets it drift away. */}
        <Pressable
          accessibilityLabel="Dismiss celebration"
          onPress={() => {
            haptics.tap();
            onClose();
          }}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          entering={ZoomIn.springify().damping(14).stiffness(160)}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <LinearGradient
            colors={theme.gradients.warm}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />

          <Animated.View style={[styles.sparkleTop, sparkleTopStyle]}>
            <Sparkles color={theme.colors.gold} size={22} strokeWidth={2} />
          </Animated.View>
          <Animated.View style={[styles.sparkleBottom, sparkleBottomStyle]}>
            <Sparkles color={theme.colors.pink} size={15} strokeWidth={2} />
          </Animated.View>

          <Animated.View
            entering={ZoomIn.delay(100).springify().damping(10)}
            style={[styles.flameWrap, shadows.card]}
          >
            <FlameBadge colors={theme.gradients.flame} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(220)} style={styles.copy}>
            <Text style={[styles.kicker, { color: theme.colors.rose }]}>
              {streak === 1 ? 'a new little ritual' : 'you showed up again'}
            </Text>
            <View style={styles.countRow}>
              <CountUp
                duration={900}
                startFrom={0}
                style={[styles.count, { color: theme.colors.ink }]}
                value={streak ?? 0}
              />
              <Text style={[styles.countLabel, { color: theme.colors.inkSoft }]}>
                {streak === 1 ? 'day' : 'days'}
              </Text>
            </View>
            <Text style={[styles.title, { color: theme.colors.ink }]}>
              {streak === 1 ? 'One little memory, safely kept' : 'in a row, without missing a day'}
            </Text>
            <Text style={[styles.message, { color: theme.colors.muted }]}>{message}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(360)} style={styles.footer}>
            <PressableScale
              accessibilityLabel="Keep going"
              haptic="none"
              onPress={() => {
                haptics.tap();
                onClose();
              }}
              style={[styles.button, { backgroundColor: theme.colors.rose }]}
            >
              <Text style={[styles.buttonText, { color: contrastInk(theme.colors.rose) }]}>Tuck it in</Text>
            </PressableScale>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** The flame breathes and casts a warm halo, like a candle behind paper. */
function FlameBadge({ colors }: { colors: ComponentProps<typeof LinearGradient>['colors'] }) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const flicker = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      pulse.value = 0;
      flicker.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    flicker.value = withRepeat(
      withTiming(1, { duration: 1350, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [flicker, pulse, reducedMotion]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.42, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.88, 1.5]) }],
  }));

  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: interpolate(flicker.value, [0, 1], [1, 1.055]) },
      { scaleX: interpolate(flicker.value, [0, 1], [1, 0.972]) },
    ],
  }));

  return (
    <View style={styles.flameStage}>
      <Animated.View style={[styles.halo, haloStyle]} />
      <Animated.View style={flameStyle}>
        <LinearGradient
          colors={colors}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.flame}
        >
          <Flame color="#FFFFFF" fill="rgba(255,255,255,0.3)" size={44} strokeWidth={2} />
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    alignItems: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 34,
    width: '100%',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 18,
  },
  sparkleTop: {
    position: 'absolute',
    right: 34,
    top: 34,
  },
  sparkleBottom: {
    bottom: 108,
    left: 30,
    position: 'absolute',
  },
  flameWrap: {
    borderRadius: 999,
  },
  flameStage: {
    alignItems: 'center',
    height: 96,
    justifyContent: 'center',
    width: 96,
  },
  halo: {
    backgroundColor: 'rgba(245,158,11,0.3)',
    borderRadius: 999,
    height: 96,
    position: 'absolute',
    width: 96,
  },
  flame: {
    alignItems: 'center',
    borderRadius: 999,
    height: 96,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 96,
  },
  copy: {
    alignItems: 'center',
    marginTop: 14,
  },
  kicker: {
    fontFamily: fonts.handBold,
    fontSize: 21,
    lineHeight: 23,
  },
  countRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  count: {
    fontFamily: fonts.serif,
    fontSize: 62,
    letterSpacing: -2,
  },
  countLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 21,
    letterSpacing: -0.4,
    marginTop: 2,
    textAlign: 'center',
  },
  message: {
    fontFamily: fonts.hand,
    fontSize: 19,
    marginTop: 6,
    textAlign: 'center',
  },
  footer: {
    marginTop: 20,
    width: '100%',
  },
  button: {
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 13,
  },
  buttonText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
