import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { useTheme } from '@/theme';

interface IconButtonProps {
  icon: LucideIcon;
  onPress?: () => void;
  size?: number;
  iconSize?: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  disabled?: boolean;
  haptic?: 'tap' | 'soft' | 'medium' | 'heavy' | 'selection' | 'none';
  /** Lets a toggle icon announce whether it is on. */
  selected?: boolean;
}

export function IconButton({
  icon: Icon,
  onPress,
  size = 44,
  iconSize = 20,
  color,
  backgroundColor,
  borderColor,
  style,
  accessibilityLabel,
  disabled,
  haptic = 'tap',
  selected,
}: IconButtonProps) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      haptic={haptic}
      onPress={onPress}
      selected={selected}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: backgroundColor ?? theme.colors.surface,
          borderColor: borderColor ?? theme.colors.border,
        },
        style,
      ]}
    >
      <View pointerEvents="none">
        <Icon color={color ?? theme.colors.inkSoft} size={iconSize} strokeWidth={2.1} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
