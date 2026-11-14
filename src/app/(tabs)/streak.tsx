import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Flame, Lock, Sparkles } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MemoryInspectionModal } from '@/components/MemoryInspectionModal';
import { CountUp } from '@/components/ui/CountUp';
import { Screen } from '@/components/ui/Screen';
import { PressableScale } from '@/components/ui/PressableScale';
import { MILESTONE_DEFINITIONS, type MilestoneId } from '@/constants';
import {
  WEEK_LABELS,
  addMonths,
  formatMonthYear,
  getMonthGrid,
  toDateKey,
} from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { getMemoriesByDate, getMilestoneProgress, getMilestones, getStats } from '@/lib/stats';
import { getMemoryStreakStatus, useMemoryStore } from '@/store/useMemoryStore';
import { contrastInk, fonts, radii, shadows, useTheme } from '@/theme';
import type { Memory } from '@/types';

const DAY_LABELS = WEEK_LABELS;

export default function StreakScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const memories = useMemoryStore((state) => state.memories);
  const streak = useMemoryStore((state) => state.streak);
  const status = getMemoryStreakStatus(streak);

  const [month, setMonth] = useState(() => new Date());
  const [monthDir, setMonthDir] = useState(1);
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);

  const stats = useMemo(() => getStats(memories), [memories]);
  const byDate = useMemo(() => getMemoriesByDate(memories), [memories]);
  const milestones = useMemo(
    () => getMilestones(memories, streak.longestStreak),
    [memories, streak.longestStreak]
  );
  const milestoneProgress = useMemo(
    () => getMilestoneProgress(memories, streak.longestStreak),
    [memories, streak.longestStreak]
  );

  const flamePulse = useSharedValue(1);
  const flameFlicker = useSharedValue(0);
  useEffect(() => {
    flamePulse.value = withRepeat(
      withTiming(1.05, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    flameFlicker.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [flameFlicker, flamePulse]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: flamePulse.value },
      { scaleY: 1 + flameFlicker.value * 0.07 },
      { scaleX: 1 - flameFlicker.value * 0.035 },
    ],
  }));

  const flameHaloStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + flameFlicker.value * 0.2,
    transform: [{ scale: 0.92 + flameFlicker.value * 0.16 }],
  }));

  const cells = useMemo(() => getMonthGrid(month), [month]);
  const todayKey = toDateKey();
  const logged = useMemo(() => new Set(streak.loggedDates), [streak.loggedDates]);
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;

  const calendarWidth = Math.min(width, 560) - 36;
  const cellSize = (calendarWidth - 24 - 6 * 4) / 7;

  // Swiping the calendar sideways flips through months, like a wall planner.
  const shiftMonth = (direction: number) => {
    haptics.tap();
    setMonthDir(direction);
    setMonth((current) => addMonths(current, direction));
  };

  const swipeX = useSharedValue(0);
  const monthSwipe = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-24, 24])
    .onUpdate((event) => {
      swipeX.value = event.translationX * 0.55;
    })
    .onEnd((event) => {
      const shouldShift = Math.abs(event.translationX) > 54 || Math.abs(event.velocityX) > 620;
      if (shouldShift) {
        runOnJS(shiftMonth)(event.translationX > 0 ? -1 : 1);
      }
      swipeX.value = withSpring(0, { damping: 18, stiffness: 220 });
    });

  const monthSwipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }));

  const openFirstOfDay = (key: string) => {
    const list = byDate.get(key);
    const memory = list?.[0] ?? null;
    if (!memory) return;
    haptics.paperRustle();
    setActiveMemory(memory);
    setInspectOpen(true);
  };

  const headline =
    status.loggedToday
      ? 'Today is tucked in. Beautifully done.'
      : status.pendingToday
        ? 'Keep the flame alive — one memory today.'
        : streak.currentStreak === 0
          ? 'Every streak begins with a single little memory.'
          : 'Tuck in a memory to keep the story going.';

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: theme.colors.rose }]}>a gentle daily ritual</Text>
          <Text style={[styles.title, { color: theme.colors.ink }]}>Your Streak</Text>
        </View>
        <View style={[styles.longestPill, { backgroundColor: theme.colors.amberSoft, borderColor: theme.colors.amber }]}>
          <Sparkles color={theme.colors.amber} size={12} strokeWidth={2.4} />
          <Text style={[styles.longestText, { color: theme.colors.inkSoft }]}>
            best {streak.longestStreak}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(420)}>
          <LinearGradient
            colors={theme.gradients.warm}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={[styles.hero, { borderColor: theme.colors.border, shadowColor: theme.colors.shadow }]}
          >
            <View style={styles.heroFlameStage}>
              <Animated.View
                pointerEvents="none"
                style={[styles.heroFlameHalo, { backgroundColor: theme.colors.amber }, flameHaloStyle]}
              />
              <Animated.View style={flameStyle}>
                <LinearGradient
                  colors={theme.gradients.flame}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={styles.heroFlame}
                >
                  <Flame color="#FFFFFF" fill="rgba(255,255,255,0.28)" size={40} strokeWidth={2} />
                </LinearGradient>
              </Animated.View>
            </View>

            <View style={styles.heroCountRow}>
              <CountUp style={[styles.heroCount, { color: theme.colors.ink }]} value={streak.currentStreak} />
              <Text style={[styles.heroUnit, { color: theme.colors.inkSoft }]}>
                {streak.currentStreak === 1 ? 'day' : 'days'}
              </Text>
            </View>
            <Text style={[styles.heroHeadline, { color: theme.colors.inkSoft }]}>{headline}</Text>

            <View style={styles.heroMeta}>
              <View style={[styles.heroChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.heroChipLabel, { color: theme.colors.muted }]}>days remembered</Text>
                <CountUp style={[styles.heroChipValue, { color: theme.colors.rose }]} value={streak.loggedDates.length} />
              </View>
              <View style={[styles.heroChip, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <Text style={[styles.heroChipLabel, { color: theme.colors.muted }]}>longest run</Text>
                <CountUp style={[styles.heroChipValue, { color: theme.colors.sage }]} value={streak.longestStreak} />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(460).delay(80)}>
          <View
            style={[
              styles.calendarCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <View style={styles.calendarHeader}>
              <Text style={[styles.calendarTitle, { color: theme.colors.ink }]}>
                {formatMonthYear(month)}
              </Text>
              <View style={styles.calendarNav}>
                <PressableScale
                  accessibilityLabel="Previous month"
                  haptic="tap"
                  onPress={() => {
                    shiftMonth(-1);
                  }}
                  style={[styles.navButton, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}
                >
                  <ChevronLeft color={theme.colors.inkSoft} size={15} strokeWidth={2.5} />
                </PressableScale>
                <PressableScale
                  accessibilityLabel="Next month"
                  haptic="tap"
                  onPress={() => {
                    shiftMonth(1);
                  }}
                  style={[styles.navButton, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}
                >
                  <ChevronRight color={theme.colors.inkSoft} size={15} strokeWidth={2.5} />
                </PressableScale>
              </View>
            </View>

            <GestureDetector gesture={monthSwipe}>
              <Animated.View style={monthSwipeStyle}>
                <Animated.View
                  entering={(monthDir > 0 ? FadeInRight : FadeInLeft).duration(260)}
                  key={`month-${monthKey}`}
                  style={styles.calendarBody}
                >
              <View style={[styles.dayLabels, { gap: 4 }]}>
                {DAY_LABELS.map((label, index) => (
                  <View key={`${label}-${index}`} style={{ width: cellSize }}>
                    <Text style={[styles.dayLabel, { color: theme.colors.faint }]}>{label}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.calendarGrid, { gap: 4 }]}>
                {cells.map((date, index) => {
                  if (!date) {
                    return <View key={`blank-${index}`} style={{ height: cellSize, width: cellSize }} />;
                  }
                  const key = toDateKey(date);
                  const isToday = key === todayKey;
                  const isLogged = logged.has(key);
                  const dayMemories = byDate.get(key);
                  const first = dayMemories?.[0] ?? null;
                  const future = date.getTime() > new Date().setHours(23, 59, 59, 999);
                  return (
                    <PressableScale
                      accessibilityLabel={`${key}${isLogged ? ', memory kept' : ''}${isToday ? ', today' : ''}`}
                      disabled={!first}
                      haptic={first ? 'tap' : 'none'}
                      key={key}
                      onPress={() => openFirstOfDay(key)}
                      scaleTo={0.9}
                      style={[
                        styles.dayCell,
                        {
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: isToday
                            ? theme.colors.roseSoft
                            : isLogged
                              ? theme.colors.amberSoft
                              : theme.colors.surfaceRaised,
                          borderColor: isToday
                            ? theme.colors.rose
                            : isLogged
                              ? theme.colors.amber
                              : theme.colors.border,
                          opacity: future ? 0.4 : 1,
                        },
                      ]}
                    >
                      {first ? (
                        <>
                          <Image
                            contentFit="cover"
                            source={{ uri: first.imageUri }}
                            style={StyleSheet.absoluteFill}
                            transition={160}
                          />
                          <View style={styles.dayShade} />
                          <Text style={[styles.dayNumberOnPhoto, { color: '#FFFFFF' }]}>{date.getDate()}</Text>
                        </>
                      ) : (
                        <Text
                          style={[
                            styles.dayNumber,
                            {
                              color: isToday ? theme.colors.rose : theme.colors.muted,
                              fontFamily: isToday ? fonts.sansBold : fonts.sansSemiBold,
                            },
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                      )}
                      {isLogged ? <View style={[styles.dayDot, { backgroundColor: theme.colors.amber }]} /> : null}
                      {isToday ? <TodayRing color={theme.colors.rose} size={cellSize} /> : null}
                    </PressableScale>
                  );
                })}
              </View>
                </Animated.View>
              </Animated.View>
            </GestureDetector>

            <Text style={[styles.calendarFoot, { color: theme.colors.muted }]}>
              little thumbnails mark the days you remembered
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(150)} style={styles.statsGrid}>
          <StatCard label="Days in a row" tone={theme.colors.rose} value={streak.currentStreak} />
          <StatCard label="Best ever" tone={theme.colors.amber} value={streak.longestStreak} />
          <StatCard label="Total memories" tone={theme.colors.sage} value={stats.totalMemories} />
          <StatCard label="Places visited" tone={theme.colors.stamp} value={stats.distinctPlaces} />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(540).delay(210)}>
          <View style={styles.milestoneHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.ink }]}>Milestone stamps</Text>
            <Text style={[styles.sectionHint, { color: theme.colors.muted }]}>tap a stamp to peek</Text>
          </View>

          <View style={styles.milestoneGrid}>
            {MILESTONE_DEFINITIONS.map((definition, index) => (
              <MilestoneBadge
                key={definition.id}
                description={definition.description}
                emoji={definition.emoji}
                index={index}
                progress={milestoneProgress[definition.id as MilestoneId]}
                target={definition.target}
                title={definition.title}
                unlocked={Boolean(milestones[definition.id as MilestoneId])}
              />
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      <MemoryInspectionModal
        memory={activeMemory}
        onClose={() => setInspectOpen(false)}
        visible={inspectOpen}
      />
    </Screen>
  );
}

/** Soft breathing ring so today's square is easy to find at a glance. */
function TodayRing({ color, size }: { color: string; size: number }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.6, 0]),
    // Kept inside the cell: the square clips its photo corners.
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.72, 0.98]) }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.todayRing,
        {
          borderColor: color,
          height: size,
          width: size,
        },
        style,
      ]}
    />
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={[styles.statBar, { backgroundColor: tone }]} />
      <CountUp style={[styles.statValue, { color: theme.colors.ink }]} value={value} />
      <Text style={[styles.statLabel, { color: theme.colors.muted }]}>{label}</Text>
    </View>
  );
}

function MilestoneBadge({
  title,
  description,
  emoji,
  target,
  unlocked,
  progress,
  index,
}: {
  title: string;
  description: string;
  emoji: string;
  target: string;
  unlocked: boolean;
  progress: { current: number; goal: number };
  index: number;
}) {
  const theme = useTheme();
  const [flipped, setFlipped] = useState(false);
  const flip = useSharedValue(0);
  const fill = useSharedValue(0);
  const stamp = useSharedValue(1);
  const wasUnlocked = useRef(unlocked);
  const ratio = progress.goal > 0 ? Math.min(1, progress.current / progress.goal) : 0;

  // A badge that just unlocked lands like a rubber stamp hitting paper.
  useEffect(() => {
    if (wasUnlocked.current || !unlocked) {
      wasUnlocked.current = unlocked;
      return;
    }
    wasUnlocked.current = true;
    stamp.value = 1.55;
    stamp.value = withSequence(
      withTiming(0.94, { duration: 120, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 9, stiffness: 240 })
    );
  }, [stamp, unlocked]);

  useEffect(() => {
    flip.value = withTiming(flipped ? 1 : 0, {
      duration: 520,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [flip, flipped]);

  useEffect(() => {
    fill.value = withTiming(ratio, { duration: 760, easing: Easing.out(Easing.cubic) });
  }, [fill, ratio]);

  // One hinge for the whole stamp: the back face simply starts rotated 180°.
  // The press-in scale is folded into the same transform so neither wins.
  const flipperStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
      {
        scale:
          interpolate(flip.value, [0, 0.5, 1], [1, 0.95, 1]) * stamp.value,
      },
    ],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  return (
    <Animated.View entering={FadeIn.duration(300).delay(index * 45)} style={styles.badgeWrap}>
      <PressableScale
        accessibilityLabel={`${title}. ${unlocked ? 'Unlocked' : 'Locked'}. ${description}`}
        haptic="paperRustle"
        onPress={() => setFlipped((current) => !current)}
        scaleTo={0.96}
        style={styles.badgePress}
      >
        <View style={styles.badgeStage}>
          <Animated.View style={[styles.badgeFlipper, flipperStyle]}>
            <View
              style={[
                styles.badgeFace,
                {
                  backgroundColor: unlocked ? theme.colors.amberSoft : theme.colors.surface,
                  borderColor: unlocked ? theme.colors.amber : theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.badgeEmoji, !unlocked && styles.badgeLockedEmoji]}>{emoji}</Text>
              <Text
                numberOfLines={2}
                style={[
                  styles.badgeTitle,
                  { color: unlocked ? theme.colors.ink : theme.colors.muted },
                ]}
              >
                {title}
              </Text>
              {unlocked ? (
                <View style={[styles.badgeTag, { backgroundColor: theme.colors.amber }]}>
                  <Text style={[styles.badgeTagText, { color: contrastInk(theme.colors.amber) }]}>
                    stamped
                  </Text>
                </View>
              ) : (
                <View style={[styles.badgeTag, { backgroundColor: theme.colors.lockedSoft }]}>
                  <Lock color={theme.colors.locked} size={9} strokeWidth={2.6} />
                  <Text style={[styles.badgeTagText, { color: theme.colors.locked }]}>{target}</Text>
                </View>
              )}

              {!unlocked ? (
                <View style={styles.badgeProgressWrap}>
                  <View style={[styles.badgeProgressTrack, { backgroundColor: theme.colors.border }]}>
                    <Animated.View
                      style={[
                        styles.badgeProgressFill,
                        { backgroundColor: theme.colors.amber },
                        progressStyle,
                      ]}
                    />
                  </View>
                  <Text style={[styles.badgeProgressLabel, { color: theme.colors.faint }]}>
                    {progress.current} / {progress.goal}
                  </Text>
                </View>
              ) : null}
            </View>

            <View
              style={[
                styles.badgeFace,
                styles.badgeBack,
                {
                  backgroundColor: theme.colors.paper,
                  borderColor: theme.colors.borderStrong,
                },
              ]}
            >
              <Text style={[styles.badgeBackTitle, { color: theme.colors.rose }]}>
                {unlocked ? 'you did it' : 'still waiting'}
              </Text>
              <Text
                numberOfLines={4}
                style={[styles.badgeDescription, { color: theme.colors.inkSoft }]}
              >
                {description}
              </Text>
              <Text style={[styles.badgeTarget, { color: theme.colors.muted }]}>{target}</Text>
            </View>
          </Animated.View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  kicker: {
    fontFamily: fonts.handBold,
    fontSize: 19,
    lineHeight: 21,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 32,
    letterSpacing: -1,
    marginTop: -3,
  },
  longestPill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  longestText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 112,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  hero: {
    alignItems: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 18,
    paddingTop: 22,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 6,
  },
  heroFlame: {
    alignItems: 'center',
    borderRadius: 999,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  heroFlameStage: {
    alignItems: 'center',
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  heroFlameHalo: {
    borderRadius: 999,
    height: 78,
    position: 'absolute',
    width: 78,
  },
  heroCountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  heroCount: {
    fontFamily: fonts.serif,
    fontSize: 58,
    letterSpacing: -2.2,
    lineHeight: 62,
  },
  heroUnit: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
  },
  heroHeadline: {
    fontFamily: fonts.hand,
    fontSize: 19,
    lineHeight: 21,
    marginTop: 2,
    textAlign: 'center',
  },
  heroMeta: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  heroChip: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 8,
  },
  heroChipLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 8,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  heroChipValue: {
    fontFamily: fonts.serif,
    fontSize: 20,
    letterSpacing: -0.5,
    marginTop: 1,
  },
  calendarCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  calendarTitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    letterSpacing: -0.4,
  },
  calendarNav: {
    flexDirection: 'row',
    gap: 6,
  },
  navButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  dayLabels: {
    flexDirection: 'row',
    marginTop: 12,
    paddingHorizontal: 0,
  },
  calendarBody: {
    width: '100%',
  },
  dayLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 8.5,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  dayCell: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dayNumber: {
    fontSize: 11,
  },
  dayNumberOnPhoto: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dayShade: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dayDot: {
    borderRadius: 2,
    bottom: 2,
    height: 3,
    position: 'absolute',
    right: 2,
    width: 3,
  },
  todayRing: {
    borderRadius: 9,
    borderWidth: 1.5,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  calendarFoot: {
    fontFamily: fonts.hand,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    overflow: 'hidden',
    paddingBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  statBar: {
    borderRadius: 999,
    height: 3,
    marginBottom: 6,
    width: 22,
  },
  statValue: {
    fontFamily: fonts.serif,
    fontSize: 26,
    letterSpacing: -0.8,
  },
  statLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 8.5,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  milestoneHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: fonts.serif,
    fontSize: 21,
    letterSpacing: -0.5,
  },
  sectionHint: {
    fontFamily: fonts.hand,
    fontSize: 15,
  },
  milestoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgeWrap: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  badgePress: {
    width: '100%',
  },
  badgeStage: {
    height: 132,
    width: '100%',
  },
  badgeFlipper: {
    height: '100%',
    width: '100%',
  },
  badgeFace: {
    alignItems: 'center',
    backfaceVisibility: 'hidden',
    borderRadius: radii.md,
    borderWidth: 1,
    height: '100%',
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 10,
    position: 'absolute',
    top: 0,
    width: '100%',
    ...shadows.soft,
  },
  badgeBack: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    transform: [{ rotateY: '180deg' }],
  },
  badgeEmoji: {
    fontSize: 26,
  },
  badgeLockedEmoji: {
    opacity: 0.35,
  },
  badgeTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.1,
    marginTop: 4,
    textAlign: 'center',
  },
  badgeTag: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 3,
    marginTop: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeTagText: {
    fontFamily: fonts.sansBold,
    fontSize: 7,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badgeProgressWrap: {
    alignSelf: 'stretch',
    gap: 3,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  badgeProgressTrack: {
    borderRadius: 999,
    height: 3,
    overflow: 'hidden',
  },
  badgeProgressFill: {
    borderRadius: 999,
    height: '100%',
  },
  badgeProgressLabel: {
    alignSelf: 'flex-end',
    fontFamily: fonts.sansSemiBold,
    fontSize: 7.5,
    letterSpacing: 0.3,
  },
  badgeBackTitle: {
    fontFamily: fonts.handBold,
    fontSize: 17,
    lineHeight: 18,
  },
  badgeDescription: {
    fontFamily: fonts.hand,
    fontSize: 14,
    lineHeight: 15,
    marginTop: 3,
  },
  badgeTarget: {
    fontFamily: fonts.sansBold,
    fontSize: 7.5,
    letterSpacing: 0.5,
    marginTop: 6,
    textTransform: 'uppercase',
  },
});
