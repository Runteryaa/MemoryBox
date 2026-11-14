import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SparkleBurst } from '@/components/SkiaParticles';
import { PressableScale } from '@/components/ui/PressableScale';
import { fonts, radii, useTheme } from '@/theme';

interface AnimatedMemoryBoxProps {
  count: number;
  lidOpen?: boolean;
  shakeKey?: number;
  burstKey?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  width?: number;
}

export function AnimatedMemoryBox({
  count,
  lidOpen = false,
  shakeKey = 0,
  burstKey = 0,
  onPress,
  onLongPress,
  width = 310,
}: AnimatedMemoryBoxProps) {
  const theme = useTheme();
  const shake = useSharedValue(0);
  const open = useSharedValue(lidOpen ? 1 : 0);
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [float]);

  useEffect(() => {
    open.value = withSpring(lidOpen ? 1 : 0, {
      damping: 16,
      stiffness: 145,
      mass: 0.75,
      overshootClamping: false,
    });
  }, [lidOpen, open]);

  useEffect(() => {
    if (shakeKey <= 0) return;
    shake.value = withSequence(
      withTiming(-1, { duration: 60 }),
      withTiming(1, { duration: 70 }),
      withTiming(-0.7, { duration: 60 }),
      withTiming(0.6, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
  }, [shake, shakeKey]);

  const boxStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -float.value * 5 },
      { translateX: shake.value * 8 },
      { rotateZ: `${shake.value * 2.4}deg` },
    ],
  }));

  const lidStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 0.82, 1], [1, 1, 0.97]),
    shadowOpacity: interpolate(open.value, [0, 1], [0.18, 0.04]),
    transform: [
      { perspective: 900 },
      { translateY: open.value * -12 },
      { rotateX: `${-78 * open.value}deg` },
    ],
  }));

  const stackStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 0.35, 1], [0.92, 1, 1]),
    transform: [
      { translateY: open.value * -12 },
      { scale: 1 + open.value * 0.05 },
    ],
  }));

  const insideGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0, 1], [0, 0.75]),
  }));

  const scale = width / 310;

  return (
    <View style={[styles.stage, { width, height: 240 * scale }]}>
      <Animated.View style={[styles.floatWrap, { transform: [{ scale }] }, boxStyle]}>
        <PressableScale
          accessibilityLabel={`Memory box with ${count} memories`}
          haptic="none"
          onLongPress={onLongPress}
          onPress={onPress}
          scaleTo={0.97}
          style={styles.press}
        >
          <View style={styles.shadow} />
          <View
            pointerEvents="none"
            style={[styles.aura, { backgroundColor: theme.colors.roseSoft, opacity: 0.4 }]}
          />

          <Animated.View style={[styles.polaroidStack, stackStyle]}>
            <View style={[styles.miniPolaroid, styles.miniOne, { backgroundColor: theme.colors.white }]}>
              <LinearGradient colors={theme.gradients.rose} style={styles.miniPhoto} />
            </View>
            <View style={[styles.miniPolaroid, styles.miniTwo, { backgroundColor: theme.colors.white }]}>
              <LinearGradient colors={theme.gradients.warm} style={styles.miniPhoto} />
            </View>
            <View style={[styles.miniPolaroid, styles.miniThree, { backgroundColor: theme.colors.white }]}>
              <LinearGradient colors={theme.gradients.flame} style={styles.miniPhoto} />
            </View>
          </Animated.View>

          <View
            style={[
              styles.boxBody,
              { backgroundColor: theme.colors.boxBaseDeep, borderColor: theme.colors.boxInside },
            ]}
          >
            <LinearGradient
              colors={theme.gradients.box}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.insideRim, { backgroundColor: theme.colors.boxInside }]}>
              <Animated.View
                style={[
                  styles.insideLight,
                  { backgroundColor: theme.colors.amber },
                  insideGlowStyle,
                ]}
              />
            </View>

            <View style={[styles.ribbonBody, { backgroundColor: theme.colors.ribbon }]} />
            <View
              style={[
                styles.label,
                {
                  backgroundColor: theme.colors.paper,
                  borderColor: theme.colors.borderStrong,
                  shadowColor: theme.colors.shadow,
                },
              ]}
            >
              <Text style={[styles.labelTop, { color: theme.colors.rose }]}>memory box</Text>
              <Text style={[styles.labelCount, { color: theme.colors.inkSoft }]}>
                {count} {count === 1 ? 'keepsake' : 'keepsakes'}
              </Text>
            </View>
            <View style={styles.cornerSparkle}>
              <Sparkles color={theme.colors.gold} size={13} strokeWidth={2.2} />
            </View>
          </View>

          <Animated.View
            style={[
              styles.lid,
              {
                borderColor: theme.colors.boxLidDeep,
                shadowColor: theme.colors.shadow,
                transformOrigin: 'bottom',
              },
              lidStyle,
            ]}
          >
            <LinearGradient
              colors={theme.gradients.lid}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={[StyleSheet.absoluteFill, styles.lidGradient]}
            />
            <View style={[styles.ribbonLid, { backgroundColor: theme.colors.ribbon }]} />
            <View
              style={[
                styles.bowLoop,
                styles.bowLeft,
                { backgroundColor: theme.colors.rose, borderColor: theme.colors.roseDeep },
              ]}
            />
            <View
              style={[
                styles.bowLoop,
                styles.bowRight,
                { backgroundColor: theme.colors.rose, borderColor: theme.colors.roseDeep },
              ]}
            />
            <View style={[styles.bowKnot, { backgroundColor: theme.colors.roseDeep }]} />
            <View
              style={[
                styles.clasp,
                { backgroundColor: theme.colors.gold, borderColor: theme.colors.goldDeep },
              ]}
            />
            <Text style={[styles.lidText, { color: theme.colors.roseDeep }]}>our little</Text>
            <Text style={[styles.lidTitle, { color: theme.colors.ink }]}>keepsakes</Text>
          </Animated.View>

          <View style={styles.sparkleFloat}>
            <Sparkles color={theme.colors.amber} size={16} strokeWidth={2} />
          </View>
          <View style={[styles.sparkleFloat, styles.sparkleFloatTwo]}>
            <Sparkles color={theme.colors.pink} size={11} strokeWidth={2} />
          </View>
        </PressableScale>
      </Animated.View>

      <View pointerEvents="none" style={[styles.burstWrap, { width, height: 240 * scale }]}>
        <SparkleBurst burstKey={burstKey} particleCount={30} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatWrap: {
    width: 310,
    height: 240,
  },
  press: {
    width: 310,
    height: 240,
  },
  shadow: {
    position: 'absolute',
    bottom: 8,
    left: 50,
    width: 210,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(60,35,20,0.22)',
    transform: [{ scaleX: 1.05 }],
  },
  aura: {
    position: 'absolute',
    bottom: 22,
    left: 30,
    width: 250,
    height: 120,
    borderRadius: 999,
  },
  boxBody: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    width: 270,
    height: 132,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  insideRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 18,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  insideLight: {
    position: 'absolute',
    top: 2,
    left: 30,
    right: 30,
    height: 9,
    borderRadius: 999,
  },
  ribbonBody: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 126,
    width: 18,
    opacity: 0.92,
  },
  label: {
    position: 'absolute',
    left: 78,
    bottom: 22,
    width: 114,
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 4,
  },
  labelTop: {
    fontFamily: fonts.handBold,
    fontSize: 15,
    lineHeight: 16,
  },
  labelCount: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 8,
    letterSpacing: 0.4,
    marginTop: 1,
    textTransform: 'uppercase',
  },
  cornerSparkle: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    opacity: 0.9,
  },
  lid: {
    position: 'absolute',
    top: 50,
    left: 10,
    width: 290,
    height: 104,
    borderRadius: 22,
    borderWidth: 2,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 9,
    zIndex: 5,
  },
  lidGradient: {
    borderRadius: 20,
  },
  ribbonLid: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 136,
    width: 18,
    opacity: 0.92,
  },
  bowLoop: {
    position: 'absolute',
    top: 58,
    width: 38,
    height: 26,
    borderWidth: 2,
    borderRadius: 20,
  },
  bowLeft: {
    left: 111,
    transform: [{ rotate: '-18deg' }],
  },
  bowRight: {
    left: 141,
    transform: [{ rotate: '18deg' }],
  },
  bowKnot: {
    position: 'absolute',
    top: 64,
    left: 138,
    width: 16,
    height: 16,
    borderRadius: 5,
    transform: [{ rotate: '45deg' }],
  },
  clasp: {
    position: 'absolute',
    bottom: 0,
    left: 134,
    width: 22,
    height: 15,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderWidth: 1.5,
  },
  lidText: {
    position: 'absolute',
    top: 13,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.hand,
    fontSize: 16,
    letterSpacing: 0.4,
  },
  lidTitle: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.serif,
    fontSize: 23,
    letterSpacing: -0.6,
  },
  polaroidStack: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    height: 120,
  },
  miniPolaroid: {
    position: 'absolute',
    width: 58,
    height: 72,
    borderRadius: 3,
    padding: 5,
    paddingBottom: 14,
    shadowColor: '#3F2A1D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  miniOne: {
    top: 38,
    left: 88,
    transform: [{ rotate: '-11deg' }],
  },
  miniTwo: {
    top: 22,
    left: 129,
    transform: [{ rotate: '5deg' }],
  },
  miniThree: {
    top: 40,
    left: 170,
    transform: [{ rotate: '12deg' }],
  },
  miniPhoto: {
    flex: 1,
    borderRadius: 1,
  },
  sparkleFloat: {
    position: 'absolute',
    top: 44,
    right: 6,
    opacity: 0.85,
  },
  sparkleFloatTwo: {
    top: 30,
    left: 8,
  },
  burstWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
