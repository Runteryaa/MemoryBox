import { StyleSheet, Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { haptics } from '@/lib/haptics';
import { contrastInk, fonts, radii, useTheme } from '@/theme';

/**
 * If a screen ever throws, the person should land on a calm, warm page that
 * offers a way back — never a raw red screen with a stack trace.
 */
export function AppErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        <View style={[styles.badge, { backgroundColor: theme.colors.amberSoft }]}>
          <AlertTriangle color={theme.colors.amber} size={26} strokeWidth={2.2} />
        </View>
        <Text style={[styles.title, { color: theme.colors.ink }]}>Something slipped</Text>
        <Text style={[styles.body, { color: theme.colors.muted }]}>
          A page in your memory box stumbled. Your keepsakes are safe — try opening it again.
        </Text>
        <Text numberOfLines={3} style={[styles.detail, { color: theme.colors.faint }]}>
          {error.message}
        </Text>
        <PressableScale
          accessibilityLabel="Try opening this page again"
          haptic="medium"
          onPress={() => {
            haptics.soft();
            retry();
          }}
          style={[styles.button, { backgroundColor: theme.colors.rose }]}
        >
          <Text style={[styles.buttonText, { color: contrastInk(theme.colors.rose) }]}>
            Try again
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    alignItems: 'center',
    borderRadius: radii.xl,
    borderWidth: 1,
    maxWidth: 360,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
  },
  badge: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    marginBottom: 14,
    width: 44,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 24,
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  detail: {
    fontFamily: fonts.sans,
    fontSize: 10,
    marginTop: 12,
    textAlign: 'center',
  },
  button: {
    borderRadius: 999,
    marginTop: 20,
    paddingHorizontal: 26,
    paddingVertical: 12,
  },
  buttonText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
