import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import Animated, {
  ZoomIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/PressableScale';
import { contrastInk, fonts, useTheme } from '@/theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  color?: string;
  selectedColor?: string;
  size?: 'sm' | 'md';
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  color,
  selectedColor,
  size = 'md',
}: ChipProps) {
  const theme = useTheme();
  const accent = selectedColor ?? color ?? theme.colors.rose;
  const selectedInk = contrastInk(accent);

  // Chips glide between their resting and selected colours rather than snapping.
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 190 });
  }, [progress, selected]);

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.surface, accent]
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.border, accent]
    ),
  }));

  // The ink rides along with the fill so the label never pops ahead of it.
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.inkSoft, selectedInk]
    ),
  }));

  return (
    <PressableScale
      accessibilityLabel={label}
      hitSlop={size === 'sm' ? 6 : undefined}
      onPress={onPress}
      selected={onPress ? selected : undefined}
      style={[styles.chip, size === 'sm' && styles.chipSmall]}
    >
      <Animated.View pointerEvents="none" style={[styles.fill, surfaceStyle]} />
      <View style={styles.inner}>
        {icon}
        <Animated.Text
          numberOfLines={1}
          style={[styles.label, size === 'sm' && styles.labelSmall, labelStyle]}
        >
          {label}
        </Animated.Text>
        {selected && onPress ? (
          <Animated.View entering={ZoomIn.springify().damping(12).stiffness(220)}>
            <Check color={selectedInk} size={13} strokeWidth={3} />
          </Animated.View>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  chipSmall: {
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  fill: {
    borderRadius: 999,
    bottom: -1,
    left: -1,
    position: 'absolute',
    right: -1,
    top: -1,
  },
  inner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
  },
  labelSmall: {
    fontSize: 11.5,
  },
});
