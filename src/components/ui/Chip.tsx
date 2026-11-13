import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

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

  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.chip,
        size === 'sm' && styles.chipSmall,
        {
          backgroundColor: selected ? accent : theme.colors.surface,
          borderColor: selected ? accent : theme.colors.border,
        },
      ]}
    >
      <View style={styles.inner}>
        {icon}
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            size === 'sm' && styles.labelSmall,
            { color: selected ? selectedInk : theme.colors.inkSoft },
          ]}
        >
          {label}
        </Text>
        {selected && onPress ? (
          <Check color={selectedInk} size={13} strokeWidth={3} />
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
  },
  chipSmall: {
    paddingHorizontal: 11,
    paddingVertical: 6,
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
