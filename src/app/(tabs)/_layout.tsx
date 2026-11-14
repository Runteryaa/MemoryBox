import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Flame, Home, LibraryBig } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '@/lib/haptics';
import { fonts, useTheme } from '@/theme';

type TabName = 'index' | 'gallery' | 'streak';

const TABS: { name: TabName; label: string; icon: LucideIcon }[] = [
  { name: 'index', label: 'Home', icon: Home },
  { name: 'gallery', label: 'Gallery', icon: LibraryBig },
  { name: 'streak', label: 'Streak', icon: Flame },
];

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.rose,
        tabBarInactiveTintColor: theme.colors.faint,
        tabBarShowLabel: true,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontFamily: fonts.sansBold,
          fontSize: 9.5,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginTop: 1,
        },
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Math.max(10, insets.bottom + 2),
          height: 72,
          borderRadius: 28,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: theme.colors.tabBarBorder,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: theme.isDark ? 0.4 : 0.16,
          shadowRadius: 18,
          paddingTop: 6,
          paddingBottom: 6,
        },
        tabBarItemStyle: {
          borderRadius: 22,
          marginHorizontal: 4,
        },
        tabBarBackground: () => (
          <View style={[styles.bgWrap, { borderColor: theme.colors.tabBarBorder }]}>
            <BlurView
              intensity={theme.isDark ? 40 : 60}
              style={StyleSheet.absoluteFill}
              tint={theme.isDark ? 'dark' : 'light'}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: theme.colors.tabBar,
                  opacity: theme.isDark ? 0.86 : 0.74,
                },
              ]}
            />
          </View>
        ),
      }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <Tabs.Screen
            key={tab.name}
            listeners={{
              tabPress: () => {
                haptics.selection();
              },
            }}
            name={tab.name}
            options={{
              title: tab.label,
              tabBarAccessibilityLabel: `${tab.label} tab`,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon color={color} focused={focused} icon={Icon} />
              ),
            }}
          />
        );
      })}
    </Tabs>
  );
}

function TabIcon({
  icon: Icon,
  color,
  focused,
}: {
  icon: LucideIcon;
  color: ColorValue;
  focused: boolean;
}) {
  const theme = useTheme();
  const scale = useSharedValue(focused ? 1.06 : 1);
  const lift = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.07 : 1, { damping: 14, stiffness: 220 });
    // A tiny hop when the tab becomes active, like a stamp pressing down.
    lift.value = focused
      ? withSequence(
          withTiming(2.4, { duration: 90 }),
          withSpring(-2.2, { damping: 8, stiffness: 260 }),
          withSpring(0, { damping: 12, stiffness: 200 })
        )
      : withSpring(0, { damping: 14, stiffness: 220 });
  }, [focused, lift, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.iconWrap, animatedStyle]}>
      {focused ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          style={[StyleSheet.absoluteFill, styles.iconGlow, { backgroundColor: theme.colors.roseSoft }]}
        />
      ) : null}
      <Icon color={color} size={21} strokeWidth={focused ? 2.5 : 2} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bgWrap: {
    borderWidth: 1,
    borderRadius: 28,
    flex: 1,
    overflow: 'hidden',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 20,
    height: 38,
    justifyContent: 'center',
    width: 58,
  },
  iconGlow: {
    borderRadius: 20,
  },
});
