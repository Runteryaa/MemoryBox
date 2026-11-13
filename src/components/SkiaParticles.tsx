import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas, Circle, useClock } from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
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
}

const BURST_COLORS = ['#F59E0B', '#F472B6', '#E11D48', '#FDE68A', '#FCA5A5', '#FBBF24'];

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
  const cx = useDerivedValue(
    () =>
      centerX +
      Math.cos(config.angle) * config.distance * Math.max(0, progress.value - config.delay * 0.2)
  );
  const cy = useDerivedValue(
    () =>
      centerY +
      Math.sin(config.angle) * config.distance * Math.max(0, progress.value - config.delay * 0.2) +
      progress.value * progress.value * 34
  );
  const radius = useDerivedValue(() => config.size * (1 - progress.value * 0.45));
  const opacity = useDerivedValue(() => {
    const local = Math.min(1, Math.max(0, (progress.value - config.delay) / 0.35));
    return Math.max(0, 1 - local) * (progress.value > 0 ? 1 : 0);
  });

  return (
    <Circle cx={cx} cy={cy} r={radius} color={config.color} opacity={opacity} />
  );
}

/** Skia particle burst used when the memory box opens or a memory lands inside. */
export function SparkleBurst({ burstKey, color, particleCount = 26 }: SparkleBurstProps) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);

  const particles = useMemo<ParticleConfig[]>(
    () =>
      Array.from({ length: particleCount }, (_, index) => ({
        angle: seeded(index, 1) * Math.PI * 2,
        distance: 30 + seeded(index, 2) * Math.max(60, Math.min(size.width, size.height) * 0.34),
        size: 1.8 + seeded(index, 3) * 3.6,
        color: color ?? BURST_COLORS[index % BURST_COLORS.length] ?? '#F59E0B',
        delay: seeded(index, 4) * 0.2,
        spin: seeded(index, 5),
      })),
    [color, particleCount, size.height, size.width]
  );

  useEffect(() => {
    if (burstKey <= 0) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1250 });
  }, [burstKey, progress]);

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
      {size.width > 0 ? (
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
      <View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            backgroundColor: theme.isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.18)',
          },
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
  const radius = 2 + seeded(index, 16) * 4;

  const cx = useDerivedValue(
    () => baseX + Math.sin(clock.value / 700 + phase) * sway
  );
  const cy = useDerivedValue(() => {
    const travel = (clock.value / 1000) * 90 * speed + offset * height;
    return (travel % (height + 100)) - 50;
  });
  const opacity = useDerivedValue(() => 0.65 + Math.sin(clock.value / 500 + phase) * 0.25);

  return (
    <Circle
      color={FALL_COLORS[index % FALL_COLORS.length] ?? '#E11D48'}
      cx={cx}
      cy={cy}
      opacity={opacity}
      r={radius}
    />
  );
}

/** Continuous confetti rain for the streak celebration overlay. */
export function CelebrationConfetti({ count = 34 }: ConfettiProps) {
  const { width, height } = useWindowDimensions();
  const clock = useClock();

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
