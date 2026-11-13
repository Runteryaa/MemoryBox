import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function run(action: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  action().catch(() => {
    // Haptics are a garnish, never a blocker.
  });
}

export const haptics = {
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  soft: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  selection: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  paperRustle: () =>
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)),
};
