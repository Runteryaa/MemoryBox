import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame } from 'lucide-react-native';
import Animated, {
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/PressableScale';
import { WEEK_LABELS, getWeekDays, toDateKey } from '@/lib/date';
import { fonts, useTheme } from '@/theme';

interface StreakPillProps {
  currentStreak: number;
  loggedDates: string[];
  pendingToday: boolean;
  loggedToday: boolean;
  onPress?: () => void;
}

export function StreakPill({
  currentStreak,
  loggedDates,
  pendingToday,
  loggedToday,
  onPress,
}: StreakPillProps) {
  const theme = useTheme();
  const pulse = useSharedValue(1);
  const logged = new Set(loggedDates);
  const week = getWeekDays();
  const todayKey = toDateKey();

  useEffect(() => {
    if (pendingToday) {
      pulse.value = withRepeat(
        withTiming(1.12, { duration: 950, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(1, { duration: 250 });
    }
  }, [pendingToday, pulse]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const subtitle = loggedToday
    ? 'Today is tucked in'
    : pendingToday
      ? 'One memory keeps it alive'
      : currentStreak === 0
        ? 'Start a fresh chapter'
        : 'Tuck in a memory today';

  return (
    <PressableScale
      accessibilityLabel={`${currentStreak} day streak. ${subtitle}`}
      haptic="soft"
      onPress={onPress}
      style={[
        styles.root,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <Animated.View style={flameStyle}>
        <LinearGradient
          colors={theme.gradients.flame}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.flame}
        >
          <Flame color="#FFFFFF" fill="rgba(255,255,255,0.25)" size={19} strokeWidth={2.4} />
        </LinearGradient>
      </Animated.View>

      <View style={styles.copy}>
        <View style={styles.countRow}>
          <Text style={[styles.count, { color: theme.colors.ink }]}>
            {currentStreak}
            <Text style={[styles.countLabel, { color: theme.colors.inkSoft }]}>
              {' '}
              {currentStreak === 1 ? 'day' : 'days'}
            </Text>
          </Text>
          <View
            style={[
              styles.stateDot,
              {
                backgroundColor: loggedToday
                  ? theme.colors.sage
                  : pendingToday
                    ? theme.colors.amber
                    : theme.colors.faint,
              },
            ]}
          />
        </View>
        <Text numberOfLines={1} style={[styles.subtitle, { color: theme.colors.muted }]}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.tracker}>
        {week.map((day, index) => {
          const key = toDateKey(day);
          const isLogged = logged.has(key);
          const isToday = key === todayKey;
          const isFuture = day.getTime() > new Date().setHours(23, 59, 59, 999);
          return (
            <View key={`${key}-${index}`} style={styles.dayItem}>
              <Text
                style={[
                  styles.dayLabel,
                  { color: isToday ? theme.colors.rose : theme.colors.faint },
                ]}
              >
                {WEEK_LABELS[index]}
              </Text>
              {isLogged ? (
                <Animated.View
                  entering={ZoomIn.springify().damping(11).delay(index * 35)}
                  style={[styles.bubble, { backgroundColor: theme.colors.amber }]}
                >
                  <View style={[styles.bubbleCore, { backgroundColor: theme.colors.white }]} />
                </Animated.View>
              ) : (
                <View
                  style={[
                    styles.bubbleEmpty,
                    {
                      borderColor: isToday ? theme.colors.rose : theme.colors.borderStrong,
                      backgroundColor: isToday ? theme.colors.roseSoft : 'transparent',
                      opacity: isFuture ? 0.45 : 1,
                    },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  flame: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  copy: {
    flexShrink: 1,
    minWidth: 92,
  },
  countRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  count: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    letterSpacing: -0.3,
  },
  countLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
  },
  stateDot: {
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 9.5,
    letterSpacing: 0.1,
    marginTop: 1,
  },
  tracker: {
    flexDirection: 'row',
    gap: 4,
  },
  dayItem: {
    alignItems: 'center',
    gap: 3,
  },
  dayLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 8,
  },
  bubble: {
    alignItems: 'center',
    borderRadius: 7,
    height: 13,
    justifyContent: 'center',
    width: 13,
  },
  bubbleCore: {
    borderRadius: 2,
    height: 4,
    opacity: 0.85,
    width: 4,
  },
  bubbleEmpty: {
    borderRadius: 7,
    borderWidth: 1,
    height: 13,
    width: 13,
  },
});
