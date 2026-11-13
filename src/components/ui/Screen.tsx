import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

interface ScreenProps {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  withGradient?: boolean;
}

export function Screen({
  children,
  edges = ['top'],
  style,
  contentStyle,
  withGradient = true,
}: ScreenProps) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }, style]}>
      {withGradient ? (
        <LinearGradient
          colors={theme.gradients.screen}
          end={{ x: 1, y: 1 }}
          locations={[0, 0.55, 1]}
          pointerEvents="none"
          start={{ x: 0.15, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          styles.blob,
          styles.blobTop,
          { backgroundColor: theme.isDark ? 'rgba(244,114,182,0.07)' : 'rgba(244,114,182,0.1)' },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.blob,
          styles.blobBottom,
          { backgroundColor: theme.isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.09)' },
        ]}
      />
      <SafeAreaView edges={edges} style={[styles.safe, contentStyle]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobTop: {
    width: 260,
    height: 260,
    top: -110,
    right: -90,
  },
  blobBottom: {
    width: 320,
    height: 320,
    bottom: -150,
    left: -130,
  },
});
