import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { Camera, Moon, Sun } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedMemoryBox } from '@/components/AnimatedMemoryBox';
import { MemoryInspectionModal } from '@/components/MemoryInspectionModal';
import { StreakPill } from '@/components/StreakPill';
import { CountUp } from '@/components/ui/CountUp';
import { Screen } from '@/components/ui/Screen';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { MOOD_MAP } from '@/constants';
import { formatLongDate, greetingForHour } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { pickRandom } from '@/lib/random';
import { getStats, getOnThisDay } from '@/lib/stats';
import { getMemoryStreakStatus, useMemoryStore } from '@/store/useMemoryStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { fonts, radii, shadows, useTheme } from '@/theme';
import type { Memory } from '@/types';

export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const boxWidth = Math.min(318, width - 64);
  const memories = useMemoryStore((state) => state.memories);
  const streak = useMemoryStore((state) => state.streak);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);

  const status = getMemoryStreakStatus(streak);
  const stats = getStats(memories);
  const onThisDay = useMemo(() => getOnThisDay(memories), [memories]);

  const [inspectOpen, setInspectOpen] = useState(false);
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [lidOpen, setLidOpen] = useState(false);
  const [emptyNudge, setEmptyNudge] = useState(false);

  const breathe = useSharedValue(1);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lidTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1.07, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [breathe]);

  const cameraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  const openMemory = useCallback((memory: Memory) => {
    setActiveMemory(memory);
    setInspectOpen(true);
  }, []);

  const reminisce = useCallback(() => {
    if (memories.length === 0) {
      haptics.soft();
      setShakeKey((key) => key + 1);
      setEmptyNudge(true);
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
      nudgeTimer.current = setTimeout(() => setEmptyNudge(false), 2600);
      return;
    }
    const memory = pickRandom(memories);
    haptics.medium();
    setShakeKey((key) => key + 1);
    setBurstKey((key) => key + 1);
    setLidOpen(true);
    if (lidTimer.current) clearTimeout(lidTimer.current);
    lidTimer.current = setTimeout(() => {
      setLidOpen(false);
      if (memory) openMemory(memory);
    }, 720);
  }, [memories, openMemory]);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    void Accelerometer.isAvailableAsync()
      .then((supported) => {
        if (!supported) return;
        Accelerometer.setUpdateInterval(240);
        let lastShake = 0;
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const force = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();
          if (force > 2.1 && now - lastShake > 1500) {
            lastShake = now;
            reminisce();
          }
        });
      })
      .catch(() => undefined);

    return () => {
      if (subscription) subscription.remove();
    };
  }, [reminisce]);

  useEffect(() => {
    return () => {
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
      if (lidTimer.current) clearTimeout(lidTimer.current);
    };
  }, []);

  const nextThemeMode = theme.isDark ? 'light' : 'dark';

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.greeting, { color: theme.colors.ink }]}>
            {greetingForHour()}
          </Text>
          <View style={styles.dateRow}>
            <Text style={[styles.date, { color: theme.colors.muted }]}>
              {formatLongDate(new Date().toISOString())}
            </Text>
            <View style={[styles.dateDot, { backgroundColor: theme.colors.rose }]} />
          </View>
        </View>
        <IconButton
          accessibilityLabel={`Switch to ${nextThemeMode} mode`}
          icon={theme.isDark ? Sun : Moon}
          onPress={() => {
            setThemeMode(nextThemeMode);
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(420).delay(40)}>
          <StreakPill
            currentStreak={streak.currentStreak}
            loggedDates={streak.loggedDates}
            loggedToday={status.loggedToday}
            onPress={() => {
              router.push('/streak');
            }}
            pendingToday={status.pendingToday}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(460).delay(110)} style={styles.boxSection}>
          <AnimatedMemoryBox
            burstKey={burstKey}
            count={memories.length}
            lidOpen={lidOpen}
            onLongPress={reminisce}
            onPress={() => {
              if (memories.length === 0) {
                router.push('/capture');
                return;
              }
              setLidOpen(true);
              setBurstKey((key) => key + 1);
              haptics.paperRustle();
              if (lidTimer.current) clearTimeout(lidTimer.current);
              lidTimer.current = setTimeout(() => setLidOpen(false), 700);
            }}
            shakeKey={shakeKey}
            width={boxWidth}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(190)} style={styles.counterBlock}>
          <View style={styles.counterRow}>
            <CountUp style={[styles.counter, { color: theme.colors.ink }]} value={memories.length} />
            <View style={styles.counterCopy}>
              <Text style={[styles.counterLabel, { color: theme.colors.inkSoft }]}>
                {memories.length === 1 ? 'keepsake tucked away' : 'keepsakes tucked away'}
              </Text>
              <Text style={[styles.counterHint, { color: theme.colors.muted }]}>
                {memories.length === 0
                  ? 'your box is waiting for its very first moment'
                  : 'hold the box — or give your phone a little shake'}
              </Text>
            </View>
          </View>

          {emptyNudge ? (
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={[styles.nudge, { backgroundColor: theme.colors.amberSoft, borderColor: theme.colors.amber }]}
            >
              <Text style={[styles.nudgeText, { color: theme.colors.inkSoft }]}>
                No memories to rummage through yet — tap the camera and tuck one in.
              </Text>
            </Animated.View>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(520).delay(260)} style={styles.statsRow}>
          <MiniStat label="this month" value={stats.memoriesThisMonth} tone={theme.colors.rose} soft={theme.colors.roseSoft} />
          <MiniStat label="places" value={stats.distinctPlaces} tone={theme.colors.sage} soft={theme.colors.sageSoft} />
          <MiniStat label="loved" value={stats.favorites} tone={theme.colors.amber} soft={theme.colors.amberSoft} />
        </Animated.View>

        {onThisDay.length > 0 ? (
          <Animated.View entering={FadeInDown.duration(540).delay(310)} style={styles.onThisDayWrap}>
            <Text style={[styles.onThisDayKicker, { color: theme.colors.rose }]}>
              on this day
            </Text>
            <Text style={[styles.onThisDayHint, { color: theme.colors.muted }]}>
              {onThisDay.length === 1
                ? 'one memory from a year gone by'
                : `${onThisDay.length} memories from years gone by`}
            </Text>
            <View style={styles.onThisDayList}>
              {onThisDay.slice(0, 2).map((memory) => (
                <OnThisDayCard
                  key={memory.id}
                  memory={memory}
                  onPress={() => openMemory(memory)}
                />
              ))}
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <Animated.View
        entering={FadeInDown.duration(600).delay(320)}
        style={[styles.fabWrap, { bottom: insets.bottom + 92 }]}
        pointerEvents="box-none"
      >
        <Animated.View style={cameraStyle}>
          <PressableScale
            accessibilityLabel="Capture a new memory"
            haptic="medium"
            onPress={() => {
              router.push('/capture');
            }}
            scaleTo={0.92}
            style={[styles.fab, shadows.card, { borderColor: theme.colors.surface }]}
          >
            <LinearGradient
              colors={theme.gradients.rose}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Camera color="#FFFFFF" size={24} strokeWidth={2.3} />
          </PressableScale>
        </Animated.View>
        <Text style={[styles.fabLabel, { color: theme.colors.muted }]}>capture</Text>
      </Animated.View>

      <MemoryInspectionModal
        memory={activeMemory}
        onClose={() => {
          setInspectOpen(false);
        }}
        visible={inspectOpen}
      />
    </Screen>
  );
}

function MiniStat({
  label,
  value,
  tone,
  soft,
}: {
  label: string;
  value: number;
  tone: string;
  soft: string;
}) {
  const theme = useTheme();
  const pop = useSharedValue(1);
  const previous = useRef(value);

  // A tucked-in memory makes its counter lean forward for a beat.
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    pop.value = withSequence(
      withTiming(1.08, { duration: 130, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 9, stiffness: 210 })
    );
  }, [pop, value]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.statCard,
        {
          backgroundColor: soft,
          borderColor: tone,
        },
        cardStyle,
      ]}
    >
      <CountUp style={[styles.statValue, { color: theme.isDark ? theme.colors.ink : tone }]} value={value} />
      <Text style={[styles.statLabel, { color: theme.colors.muted }]}>{label}</Text>
    </Animated.View>
  );
}

/** A little window back in time — the same day, one or more years ago. */
function OnThisDayCard({ memory, onPress }: { memory: Memory; onPress: () => void }) {
  const theme = useTheme();
  const mood = MOOD_MAP[memory.moodTag] ?? MOOD_MAP.cozy;
  const years = Math.max(1, new Date().getFullYear() - new Date(memory.dateCreated).getFullYear());
  const yearsAgo = years === 1 ? 'a year ago' : `${years} years ago`;

  return (
    <PressableScale
      accessibilityLabel={`Memory from ${yearsAgo}: ${memory.shortTitle}`}
      haptic="paperRustle"
      onPress={onPress}
      scaleTo={0.97}
      style={[
        styles.onThisDayCard,
        {
          backgroundColor: theme.colors.white,
          borderColor: theme.colors.paperEdge,
        },
        shadows.soft,
      ]}
    >
      <Image
        contentFit="cover"
        source={{ uri: memory.imageUri }}
        style={styles.onThisDayImage}
        transition={160}
      />
      <View style={styles.onThisDayCopy}>
        <Text numberOfLines={2} style={[styles.onThisDayTitle, { color: theme.colors.ink }]}>
          {memory.shortTitle}
        </Text>
        <View style={styles.onThisDayMeta}>
          <Text style={styles.onThisDayMood}>{mood.emoji}</Text>
          <Text style={[styles.onThisDayAge, { color: theme.colors.muted }]}>{yearsAgo}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  headerCopy: {
    flex: 1,
  },
  greeting: {
    fontFamily: fonts.serif,
    fontSize: 30,
    letterSpacing: -0.9,
  },
  dateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 1,
  },
  date: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11.5,
    letterSpacing: 0.3,
  },
  dateDot: {
    borderRadius: 2,
    height: 4,
    opacity: 0.7,
    width: 4,
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 132,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  boxSection: {
    alignItems: 'center',
    marginTop: 2,
  },
  counterBlock: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  counterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  counter: {
    fontFamily: fonts.serif,
    fontSize: 44,
    letterSpacing: -1.6,
    lineHeight: 48,
  },
  counterCopy: {
    flex: 1,
  },
  counterLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    letterSpacing: 0.1,
  },
  counterHint: {
    fontFamily: fonts.hand,
    fontSize: 16,
    lineHeight: 18,
    marginTop: 1,
  },
  nudge: {
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
  },
  nudgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  statCard: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  statValue: {
    fontFamily: fonts.serif,
    fontSize: 22,
    letterSpacing: -0.6,
  },
  statLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 8.5,
    letterSpacing: 0.7,
    marginTop: -1,
    textTransform: 'uppercase',
  },
  onThisDayWrap: {
    marginTop: 6,
  },
  onThisDayKicker: {
    fontFamily: fonts.handBold,
    fontSize: 20,
    lineHeight: 22,
  },
  onThisDayHint: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 0.2,
    marginTop: -1,
  },
  onThisDayList: {
    gap: 10,
    marginTop: 9,
  },
  onThisDayCard: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    padding: 8,
  },
  onThisDayImage: {
    borderRadius: radii.sm,
    height: 60,
    width: 60,
  },
  onThisDayCopy: {
    flex: 1,
  },
  onThisDayTitle: {
    fontFamily: fonts.handBold,
    fontSize: 19,
    lineHeight: 20,
  },
  onThisDayMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  onThisDayMood: {
    fontSize: 11,
  },
  onThisDayAge: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fabWrap: {
    alignItems: 'center',
    position: 'absolute',
    right: 20,
  },
  fab: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 3,
    height: 62,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 62,
  },
  fabLabel: {
    fontFamily: fonts.handBold,
    fontSize: 15,
    marginTop: 3,
  },
});
