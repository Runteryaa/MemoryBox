import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas, Circle, Group, Path, RoundedRect, useClock } from '@shopify/react-native-skia';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

interface SparkleBurstProps {
  burstKey: number;
  color?: string;
  particleCount?: number;
}

interface ParticleConfig {
  angle: number;
  distance: number;
  size: number;
  color: string;
  delay: number;
  spin: number;
  drift: number;
}

const BURST_COLORS = ['#F59E0B', '#F472B6', '#E11D48', '#FDE68A', '#FCA5A5', '#FBBF24'];

/** A soft four-point sparkle, drawn around the origin and scaled per particle. */
const STAR_PATH =
  'M 0 -1 L 0.2 -0.2 L 1 0 L 0.2 0.2 L 0 1 L -0.2 0.2 L -1 0 L -0.2 -0.2 Z';

function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function BurstParticle({
  config,
  progress,
  centerX,
  centerY,
}: {
  config: ParticleConfig;
  progress: SharedValue<number>;
  centerX: number;
  centerY: number;
}) {
  // Skia only accepts plain numbers inside a transform array, so the whole
  // matrix is derived at once instead of per-property.
  const transform = useDerivedValue(() => {
    const travel = config.distance * Math.max(0, progress.value - config.delay * 0.2);
    const grow = Math.min(1, Math.max(0, (progress.value - config.delay) / 0.16));
    return [
      { translateX: centerX + Math.cos(config.angle) * travel },
      {
        translateY:
          centerY +
          Math.sin(config.angle) * travel +
          progress.value * progress.value * (24 + config.drift),
      },
      { rotate: config.spin * Math.PI * 2 + progress.value * Math.PI * (0.6 + config.spin) },
      { scale: config.size * (0.25 + grow * 0.75) * (1 - progress.value * 0.5) },
    ];
  });
  const opacity = useDerivedValue(() => {
    const local = Math.min(1, Math.max(0, (progress.value - config.delay) / 0.35));
    return Math.max(0, 1 - local) * (progress.value > 0 ? 1 : 0);
  });

  return (
    <Group opacity={opacity} transform={transform}>
      <Path color={config.color} path={STAR_PATH} />
      <Circle color={config.color} cx={0} cy={0} opacity={0.35} r={1.7} />
    </Group>
  );
}

/** Skia particle burst used when the memory box opens or a memory lands inside. */
export function SparkleBurst({ burstKey, color, particleCount = 26 }: SparkleBurstProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);
  // The warm glow under the sparks is a breath, not a lamp: it fades away with
  // the burst instead of staying lit behind the box forever.
  const glowOpacity = useSharedValue(0);

  const particles = useMemo<ParticleConfig[]>(
    () =>
      Array.from({ length: particleCount }, (_, index) => ({
        angle: seeded(index, 1) * Math.PI * 2,
        distance: 30 + seeded(index, 2) * Math.max(60, Math.min(size.width, size.height) * 0.34),
        size: 6 + seeded(index, 3) * 9,
        color: color ?? BURST_COLORS[index % BURST_COLORS.length] ?? '#F59E0B',
        delay: seeded(index, 4) * 0.2,
        spin: seeded(index, 5),
        drift: seeded(index, 6) * 26,
      })),
    [color, particleCount, size.height, size.width]
  );

  useEffect(() => {
    if (burstKey <= 0) return;
    progress.value = 0;
    if (reducedMotion) {
      // A single still breath of light, then nothing left glowing.
      progress.value = 1;
      glowOpacity.value = 1;
      const timer = setTimeout(() => {
        glowOpacity.value = 0;
      }, 650);
      return () => clearTimeout(timer);
    }
    glowOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 950 })
    );
    progress.value = withTiming(1, { duration: 1250 });
  }, [burstKey, glowOpacity, progress, reducedMotion]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  if (burstKey <= 0) return null;

  return (
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((current) =>
          current.width === width && current.height === height ? current : { width, height }
        );
      }}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center]}
    >
      {size.width > 0 && !reducedMotion ? (
        <Canvas style={{ width: size.width, height: size.height }}>
          {particles.map((particle, index) => (
            <BurstParticle
              centerX={size.width / 2}
              centerY={size.height / 2}
              config={particle}
              key={`${burstKey}-${index}`}
              progress={progress}
            />
          ))}
        </Canvas>
      ) : null}
      {/* With motion reduced, the burst becomes a single warm breath of light. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: theme.isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.18)',
          },
          glowStyle,
        ]}
      />
    </View>
  );
}

const FALL_COLORS = ['#E11D48', '#F472B6', '#F59E0B', '#FDE68A', '#4D7C0F', '#FB7185'];

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
  },
});

interface ConfettiProps {
  count?: number;
}

function ConfettiParticle({
  index,
  clock,
  width,
  height,
}: {
  index: number;
  clock: SharedValue<number>;
  width: number;
  height: number;
}) {
  const baseX = seeded(index, 11) * width;
  const speed = 0.6 + seeded(index, 12) * 1.1;
  const sway = 14 + seeded(index, 13) * 40;
  const phase = seeded(index, 14) * Math.PI * 2;
  const offset = seeded(index, 15);
  const size = 3 + seeded(index, 16) * 5;
  const spin = 0.6 + seeded(index, 17) * 1.8;

  const transform = useDerivedValue(() => {
    const travel = (clock.value / 1000) * 90 * speed + offset * height;
    return [
      { translateX: baseX + Math.sin(clock.value / 700 + phase) * sway },
      { translateY: (travel % (height + 100)) - 50 },
      { rotate: (clock.value / 1000) * spin * Math.PI + phase },
      // Flipping the strip on its own axis reads as a real paper flake, not a dot.
      { scaleX: Math.max(0.18, Math.abs(Math.cos(clock.value / 420 + phase * 1.7))) },
    ];
  });
  const opacity = useDerivedValue(() => 0.6 + Math.sin(clock.value / 500 + phase) * 0.3);

  return (
    <Group opacity={opacity} transform={transform}>
      <RoundedRect
        color={FALL_COLORS[index % FALL_COLORS.length] ?? '#E11D48'}
        height={size * 1.8}
        r={size * 0.35}
        width={size}
        x={-size / 2}
        y={-size * 0.9}
      />
    </Group>
  );
}

/** Continuous confetti rain for the streak celebration overlay. */
export function CelebrationConfetti({ count = 34 }: ConfettiProps) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const clock = useClock();

  // Confetti is pure decoration; with motion reduced the overlay's own words
  // carry the celebration instead of a screen full of falling paper.
  if (reducedMotion) return null;

  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, index) => (
        <ConfettiParticle
          clock={clock}
          height={height}
          index={index}
          key={index}
          width={width}
        />
      ))}
    </Canvas>
  );
}
