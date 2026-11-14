import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ChevronLeft, ChevronRight, Grid2x2, Heart, Layers, Search, Sparkles, X } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { FlippablePolaroidCard } from '@/components/FlippablePolaroidCard';
import { MemoryInspectionModal } from '@/components/MemoryInspectionModal';
import { Screen } from '@/components/ui/Screen';
import { Chip } from '@/components/ui/Chip';
import { PressableScale } from '@/components/ui/PressableScale';
import { MOODS, MOOD_MAP } from '@/constants';
import { formatMediumDate } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { getDistinctCities } from '@/lib/stats';
import { filterMemories, useMemoryStore, type MemorySort } from '@/store/useMemoryStore';
import { contrastInk, fonts, radii, shadows, useTheme } from '@/theme';
import type { Memory, MoodTag } from '@/types';

type ViewMode = 'pile' | 'grid';

const SORT_OPTIONS: { id: MemorySort; label: string }[] = [
  { id: 'newest', label: 'newest' },
  { id: 'oldest', label: 'oldest' },
  { id: 'loved', label: 'loved' },
  { id: 'title', label: 'a–z' },
];

export default function GalleryScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const memories = useMemoryStore((state) => state.memories);
  const toggleFavorite = useMemoryStore((state) => state.toggleFavorite);

  const [mode, setMode] = useState<ViewMode>('pile');
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mood, setMood] = useState<MoodTag | 'all'>('all');
  const [city, setCity] = useState<string | 'all'>('all');
  const [sort, setSort] = useState<MemorySort>('newest');
  const [pileIndex, setPileIndex] = useState(0);
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);

  const cities = useMemo(() => getDistinctCities(memories), [memories]);
  const filtered = useMemo(
    () => filterMemories(memories, { query, mood, city, sort }),
    [city, memories, mood, query, sort]
  );

  // The search bar warms up under the finger instead of just changing colour.
  const focus = useSharedValue(searchFocused ? 1 : 0);
  useEffect(() => {
    focus.value = withTiming(searchFocused ? 1 : 0, { duration: 200 });
  }, [focus, searchFocused]);

  const searchBarStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [theme.colors.border, theme.colors.rose]
    ),
    transform: [{ scale: 1 + focus.value * 0.012 }],
  }));

  const searchGlowStyle = useAnimatedStyle(() => ({
    opacity: focus.value * 0.5,
  }));

  const topMemory = filtered.length > 0 ? filtered[pileIndex % filtered.length] ?? null : null;

  const openMemory = useCallback((memory: Memory) => {
    setActiveMemory(memory);
    setInspectOpen(true);
  }, []);

  const cyclePile = useCallback(
    (direction: number) => {
      if (filtered.length < 2) return;
      haptics.selection();
      setPileIndex((current) => (current + direction + filtered.length) % filtered.length);
    },
    [filtered.length]
  );

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, { color: theme.colors.rose }]}>all your little moments</Text>
          <Text style={[styles.title, { color: theme.colors.ink }]}>Gallery</Text>
        </View>
        <View
          style={[
            styles.modeToggle,
            { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border },
          ]}
        >
          <ModeButton
            active={mode === 'pile'}
            icon={Layers}
            label="Pile"
            onPress={() => setMode('pile')}
          />
          <ModeButton
            active={mode === 'grid'}
            icon={Grid2x2}
            label="Grid"
            onPress={() => setMode('grid')}
          />
        </View>
      </View>

      <Animated.View style={[styles.searchBar, { backgroundColor: theme.colors.surface }, searchBarStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.searchGlow, { backgroundColor: theme.colors.roseSoft }, searchGlowStyle]}
        />
        <Search
          color={searchFocused ? theme.colors.rose : theme.colors.faint}
          size={17}
          strokeWidth={2.3}
        />
        <TextInput
          onBlur={() => setSearchFocused(false)}
          onChangeText={(text) => {
            setQuery(text);
            setPileIndex(0);
          }}
          onFocus={() => setSearchFocused(true)}
          placeholder="Search titles, stories, places…"
          placeholderTextColor={theme.colors.faint}
          style={[styles.searchInput, { color: theme.colors.ink }]}
          value={query}
        />
        {query.length > 0 ? (
          <PressableScale
            accessibilityLabel="Clear search"
            haptic="none"
            onPress={() => setQuery('')}
            style={[styles.clearButton, { backgroundColor: theme.colors.surfaceRaised }]}
          >
            <X color={theme.colors.muted} size={13} strokeWidth={2.6} />
          </PressableScale>
        ) : null}
      </Animated.View>

      <View>
        <ScrollView
          contentContainerStyle={styles.filterContent}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <Chip
            label="All moods"
            onPress={() => {
              setMood('all');
              setPileIndex(0);
            }}
            selected={mood === 'all'}
            size="sm"
          />
          {MOODS.map((option) => (
            <Chip
              key={option.id}
              color={option.color}
              icon={<Text style={styles.chipEmoji}>{option.emoji}</Text>}
              label={option.label}
              onPress={() => {
                setMood(option.id);
                setPileIndex(0);
              }}
              selected={mood === option.id}
              size="sm"
            />
          ))}
          {cities.length > 0 ? <View style={[styles.chipDivider, { backgroundColor: theme.colors.borderStrong }]} /> : null}
          {cities.map((option) => (
            <Chip
              key={option}
              color={theme.colors.sage}
              icon={<Text style={styles.chipEmoji}>📍</Text>}
              label={option}
              onPress={() => {
                setCity(city === option ? 'all' : option);
                setPileIndex(0);
              }}
              selected={city === option}
              size="sm"
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.resultRow}>
        <Text style={[styles.resultText, { color: theme.colors.muted }]}>
          {filtered.length} {filtered.length === 1 ? 'memory' : 'memories'}
          {mood !== 'all' || city !== 'all' || query.trim() ? ' found' : ' in your box'}
        </Text>
        {filtered.length > 0 && mode === 'pile' ? (
          <Text style={[styles.pileCount, { color: theme.colors.faint }]}>
            {(pileIndex % filtered.length) + 1} / {filtered.length}
          </Text>
        ) : null}
      </View>

      {filtered.length > 1 ? (
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((option) => {
            const active = sort === option.id;
            return (
              <PressableScale
                accessibilityLabel={`Sort by ${option.label}`}
                haptic="selection"
                key={option.id}
                onPress={() => {
                  setSort(option.id);
                  setPileIndex(0);
                }}
                style={[
                  styles.sortPill,
                  {
                    backgroundColor: active ? theme.colors.surfaceRaised : 'transparent',
                    borderColor: active ? theme.colors.rose : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sortText,
                    { color: active ? theme.colors.rose : theme.colors.faint },
                  ]}
                >
                  {option.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          hasMemories={memories.length > 0}
          onReset={() => {
            setQuery('');
            setMood('all');
            setCity('all');
            setPileIndex(0);
          }}
        />
      ) : mode === 'pile' ? (
        <PileView
          cardWidth={Math.min(268, width - 104)}
          cyclePile={cyclePile}
          memories={filtered}
          onOpen={openMemory}
          pileIndex={pileIndex}
          topMemory={topMemory}
        />
      ) : (
        <GridView
          memories={filtered}
          onOpen={openMemory}
          onToggleFavorite={toggleFavorite}
          width={width}
        />
      )}

      <MemoryInspectionModal
        memory={activeMemory}
        onClose={() => setInspectOpen(false)}
        visible={inspectOpen}
      />
    </Screen>
  );
}

function ModeButton({
  active,
  icon: Icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: typeof Layers;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const activeInk = contrastInk(theme.colors.rose);
  const iconScale = useSharedValue(1);
  const iconTurn = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      iconScale.value = withSpring(1, { damping: 14, stiffness: 220 });
      return;
    }
    iconScale.value = withSequence(
      withTiming(1.22, { duration: 110 }),
      withSpring(1, { damping: 9, stiffness: 260 })
    );
    iconTurn.value = withSequence(
      withTiming(-12, { duration: 110 }),
      withSpring(0, { damping: 10, stiffness: 240 })
    );
  }, [active, iconScale, iconTurn]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }, { rotate: `${iconTurn.value}deg` }],
  }));

  return (
    <PressableScale
      accessibilityLabel={`${label} view`}
      haptic="selection"
      onPress={onPress}
      style={[
        styles.modeButton,
        { backgroundColor: active ? theme.colors.rose : 'transparent' },
      ]}
    >
      <Animated.View style={iconStyle}>
        <Icon
          color={active ? activeInk : theme.colors.muted}
          size={14}
          strokeWidth={2.5}
        />
      </Animated.View>
      <Text
        style={[
          styles.modeLabel,
          { color: active ? activeInk : theme.colors.muted },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

function PileView({
  memories,
  pileIndex,
  topMemory,
  cardWidth,
  cyclePile,
  onOpen,
}: {
  memories: Memory[];
  pileIndex: number;
  topMemory: Memory | null;
  cardWidth: number;
  cyclePile: (direction: number) => void;
  onOpen: (memory: Memory) => void;
}) {
  const theme = useTheme();
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const pull = useSharedValue(0);
  const enter = useSharedValue(1);
  const currentIndex = pileIndex % memories.length;

  // A fresh card rises from the middle of the deck instead of popping into place.
  useEffect(() => {
    enter.value = 0;
    enter.value = withSpring(1, { damping: 15, stiffness: 180 });
  }, [currentIndex, enter]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      translateX.value = event.translationX;
      rotate.value = event.translationX / 18;
      pull.value = Math.min(1, Math.abs(event.translationX) / 150);
    })
    .onEnd((event) => {
      const shouldAdvance = Math.abs(event.translationX) > 70 || Math.abs(event.velocityX) > 650;
      if (shouldAdvance) {
        const direction = event.translationX > 0 ? -1 : 1;
        translateX.value = withTiming(direction * 430, { duration: 180 }, (finished) => {
          if (!finished) return;
          runOnJS(cyclePile)(direction);
          translateX.value = 0;
          rotate.value = 0;
          pull.value = 0;
        });
        rotate.value = withTiming(direction * 18, { duration: 180 });
      } else {
        translateX.value = withSpring(0, { damping: 16, stiffness: 220 });
        rotate.value = withSpring(0, { damping: 16, stiffness: 220 });
        pull.value = withSpring(0, { damping: 18, stiffness: 200 });
      }
    });

  const dragStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 1], [0, 1]),
    transform: [
      { translateX: translateX.value },
      { translateY: interpolate(enter.value, [0, 1], [18, 0]) - pull.value * 6 },
      { scale: interpolate(enter.value, [0, 1], [0.965, 1]) + pull.value * 0.025 },
      { rotate: `${rotate.value + (topMemory?.rotationAngle ?? 0) * 0.4}deg` },
    ],
  }));

  // The card tilts toward the edge it is being thrown off, and dims a touch.
  const dimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [0, 1], [0, 0.18]),
  }));

  // The deck behind leans forward and evens out as the front card is pulled away.
  const behind: Memory[] = [1, 2]
    .map((step) => memories[(currentIndex + step) % memories.length])
    .filter((memory): memory is Memory => memory != null && memory.id !== topMemory?.id);

  if (!topMemory) return null;

  return (
    <View style={styles.pileStage}>
      <View style={styles.pileStack}>
        {behind.map((memory, index) => (
          <PileBackCard
            cardWidth={cardWidth}
            depth={index + 1}
            key={`${memory.id}-${currentIndex}`}
            memory={memory}
            pull={pull}
          />
        ))}

        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.pileCard, dragStyle]}>
            <View>
              <FlippablePolaroidCard
                memory={topMemory}
                onPressFront={() => {
                  haptics.paperRustle();
                  onOpen(topMemory);
                }}
                rotation={0}
                showHint={false}
                width={cardWidth}
              />
              <Animated.View pointerEvents="none" style={[styles.pileDim, dimStyle]} />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.pileActions}>
        <PressableScale
          accessibilityLabel="Previous memory"
          onPress={() => cyclePile(-1)}
          style={[styles.pileNav, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <ChevronLeft color={theme.colors.inkSoft} size={16} strokeWidth={2.6} />
        </PressableScale>
        <View style={styles.pileHintWrap}>
          <Text style={[styles.pileHint, { color: theme.colors.muted }]}>
            swipe the photo to rummage
          </Text>
          <View style={[styles.pileHintLine, { backgroundColor: theme.colors.borderStrong }]} />
          <Text style={[styles.pileHintSub, { color: theme.colors.faint }]}>
            tap it to open the story
          </Text>
        </View>
        <PressableScale
          accessibilityLabel="Next memory"
          onPress={() => cyclePile(1)}
          style={[styles.pileNav, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <ChevronRight color={theme.colors.inkSoft} size={16} strokeWidth={2.6} />
        </PressableScale>
      </View>
    </View>
  );
}

function PileBackCard({
  memory,
  cardWidth,
  depth,
  pull,
}: {
  memory: Memory;
  cardWidth: number;
  depth: number;
  pull: SharedValue<number>;
}) {
  const theme = useTheme();
  const baseOffset = depth * 9;

  const style = useAnimatedStyle(() => {
    const forward = depth === 1 ? pull.value * 0.85 : pull.value * 0.45;
    return {
      opacity: (0.55 - (depth - 1) * 0.12) + forward * 0.32,
      transform: [
        { translateY: baseOffset * (1 - forward) },
        {
          translateX: (depth % 2 === 0 ? baseOffset : -baseOffset) * (1 - forward),
        },
        { scale: 1 + forward * 0.018 },
        {
          rotate: `${(depth % 2 === 0 ? 1 : -1) * (3 + baseOffset / 4) * (1 - forward * 0.7)}deg`,
        },
      ],
    };
  });

  return (
    <Animated.View style={[styles.pileCard, style]}>
      <View
        style={[
          styles.pileCardPlaceholder,
          {
            width: cardWidth,
            height: cardWidth * 1.28,
            backgroundColor: theme.colors.white,
            borderColor: theme.colors.paperEdge,
          },
        ]}
      >
        <Image
          contentFit="cover"
          source={{ uri: memory.imageUri }}
          style={styles.pilePlaceholderImage}
          transition={120}
        />
        <Text
          numberOfLines={2}
          style={[styles.pilePlaceholderText, { color: theme.colors.ink }]}
        >
          {memory.shortTitle}
        </Text>
      </View>
    </Animated.View>
  );
}

function GridView({
  memories,
  width,
  onOpen,
  onToggleFavorite,
}: {
  memories: Memory[];
  width: number;
  onOpen: (memory: Memory) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const gap = 12;
  const horizontalPadding = 18;
  const columnWidth = (Math.min(width, 560) - horizontalPadding * 2 - gap) / 2;

  return (
    <ScrollView
      contentContainerStyle={styles.gridContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.gridRow}>
        {[0, 1].map((column) => (
          <View key={column} style={styles.gridColumn}>
            {memories
              .filter((_, index) => index % 2 === column)
              .map((memory, index) => {
                const tall = (memory.id.charCodeAt(0) + index) % 3 === 0;
                const imageHeight = columnWidth * (tall ? 1.18 : 0.92);
                return (
                  <GridCard
                    imageHeight={imageHeight}
                    index={index}
                    key={memory.id}
                    memory={memory}
                    onOpen={onOpen}
                    onToggleFavorite={onToggleFavorite}
                  />
                );
              })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function GridCard({
  memory,
  index,
  imageHeight,
  onOpen,
  onToggleFavorite,
}: {
  memory: Memory;
  index: number;
  imageHeight: number;
  onOpen: (memory: Memory) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const theme = useTheme();
  const heart = useSharedValue(1);

  const pop = () => {
    heart.value = withSequence(
      withTiming(1.32, { duration: 110 }),
      withSpring(1, { damping: 9, stiffness: 240 })
    );
    onToggleFavorite(memory.id);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(Math.min(index, 9) * 34)}
    >
      <PressableScale
        accessibilityLabel={`Open memory ${memory.shortTitle}`}
        onPress={() => {
          haptics.paperRustle();
          onOpen(memory);
        }}
        scaleTo={0.96}
        style={[
          styles.gridCard,
          {
            backgroundColor: theme.colors.white,
            borderColor: theme.colors.paperEdge,
            transform: [{ rotate: `${memory.rotationAngle * 0.35}deg` }],
          },
          shadows.soft,
        ]}
      >
        <View style={{ height: imageHeight }}>
          <Image
            contentFit="cover"
            source={{ uri: memory.imageUri }}
            style={StyleSheet.absoluteFill}
            transition={180}
          />
          <View style={[styles.gridTape, { backgroundColor: theme.colors.roseSoft }]} />
          <PressableScale
            accessibilityLabel={memory.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
            haptic="tap"
            onPress={pop}
            style={[
              styles.gridHeart,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(28,25,23,0.7)'
                  : 'rgba(255,255,255,0.85)',
              },
            ]}
          >
            <Animated.View style={{ transform: [{ scale: heart }] }}>
              <Heart
                color={memory.isFavorite ? theme.colors.rose : theme.colors.inkSoft}
                fill={memory.isFavorite ? theme.colors.rose : 'transparent'}
                size={13}
                strokeWidth={2.4}
              />
            </Animated.View>
          </PressableScale>
        </View>
        <View style={styles.gridCaption}>
          <Text
            numberOfLines={2}
            style={[styles.gridTitle, { color: theme.colors.ink }]}
          >
            {memory.shortTitle}
          </Text>
          <View style={styles.gridMetaRow}>
            <Text style={[styles.gridMoodEmoji]}>{MOOD_MAP[memory.moodTag].emoji}</Text>
            <Text style={[styles.gridDate, { color: theme.colors.muted }]}>
              {formatMediumDate(memory.dateCreated)}
            </Text>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

function EmptyState({
  hasMemories,
  onReset,
}: {
  hasMemories: boolean;
  onReset?: () => void;
}) {
  const theme = useTheme();
  const drift = useSharedValue(0);
  const halo = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    // A ring of warmth keeps radiating out of the icon, like a kept promise.
    halo.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
  }, [drift, halo]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -drift.value * 6 },
      { rotate: `${-5 + drift.value * 10}deg` },
    ],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(halo.value, [0, 1], [0.5, 0]),
    transform: [{ scale: interpolate(halo.value, [0, 1], [1, 1.75]) }],
  }));

  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.empty}>
      <View style={styles.emptyIconStage}>
        <Animated.View
          pointerEvents="none"
          style={[styles.emptyHalo, { borderColor: theme.colors.rose }, haloStyle]}
        />
        <Animated.View
          style={[styles.emptyIcon, { backgroundColor: theme.colors.roseSoft }, iconStyle]}
        >
          <Sparkles color={theme.colors.rose} size={26} strokeWidth={2} />
        </Animated.View>
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.ink }]}>
        {hasMemories ? 'Nothing matches that rummage' : 'No memories in the box yet'}
      </Text>
      <Text style={[styles.emptyText, { color: theme.colors.muted }]}>
        {hasMemories
          ? 'Try another mood, city, or a softer search.'
          : 'Capture a moment or pick a photo from your library — then tuck it in.'}
      </Text>
      {!hasMemories ? (
        <PressableScale
          accessibilityLabel="Capture your first memory"
          haptic="medium"
          onPress={() => router.push('/capture')}
          style={[styles.emptyButton, { backgroundColor: theme.colors.rose }]}
        >
          <Text style={[styles.emptyButtonText, { color: contrastInk(theme.colors.rose) }]}>
            Capture a memory
          </Text>
        </PressableScale>
      ) : onReset ? (
        <PressableScale
          accessibilityLabel="Clear filters and searches"
          haptic="tap"
          onPress={onReset}
          style={[
            styles.emptyButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[styles.emptyButtonText, { color: theme.colors.inkSoft }]}>
            Clear the rummage
          </Text>
        </PressableScale>
      ) : null}
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
  headerCopy: {
    flex: 1,
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
  modeToggle: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    padding: 3,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  modeLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  searchBar: {
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 18,
    marginTop: 12,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchGlow: {
    borderRadius: radii.pill,
    bottom: -1,
    left: -1,
    position: 'absolute',
    right: -1,
    top: -1,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 13.5,
    padding: 0,
  },
  clearButton: {
    alignItems: 'center',
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  filterContent: {
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 4,
  },
  chipEmoji: {
    fontSize: 11,
  },
  chipDivider: {
    height: 18,
    marginHorizontal: 3,
    opacity: 0.5,
    width: 1,
  },
  resultRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  resultText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  pileCount: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  sortRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 7,
  },
  sortPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sortText: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  pileStage: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 96,
  },
  pileStack: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginTop: 6,
  },
  pileCard: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  pileDim: {
    bottom: 0,
    backgroundColor: '#2D241D',
    borderRadius: 6,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  pileCardPlaceholder: {
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 6,
    paddingBottom: 4,
  },
  pilePlaceholderImage: {
    borderRadius: 2,
    flex: 1,
    width: '100%',
  },
  pilePlaceholderText: {
    fontFamily: fonts.handBold,
    fontSize: 16,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'center',
  },
  pileActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  pileNav: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  pileHintWrap: {
    alignItems: 'center',
    flex: 1,
  },
  pileHint: {
    fontFamily: fonts.hand,
    fontSize: 16,
  },
  pileHintLine: {
    height: 1,
    marginVertical: 2,
    opacity: 0.5,
    width: 26,
  },
  pileHintSub: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 8.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  gridContent: {
    paddingBottom: 110,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridColumn: {
    flex: 1,
    gap: 12,
  },
  gridCard: {
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 5,
    paddingBottom: 0,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  gridTape: {
    height: 12,
    left: '34%',
    opacity: 0.85,
    position: 'absolute',
    top: -1,
    transform: [{ rotate: '-2deg' }],
    width: '32%',
  },
  gridHeart: {
    alignItems: 'center',
    borderRadius: 999,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    top: 6,
    width: 24,
  },
  gridCaption: {
    paddingBottom: 8,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  gridTitle: {
    fontFamily: fonts.handBold,
    fontSize: 17,
    lineHeight: 18,
  },
  gridDate: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 7.5,
    letterSpacing: 0.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  gridMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  gridMoodEmoji: {
    fontSize: 7.5,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 100,
    paddingHorizontal: 40,
  },
  emptyIconStage: {
    alignItems: 'center',
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  emptyHalo: {
    borderRadius: 999,
    borderWidth: 1.5,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  emptyTitle: {
    fontFamily: fonts.serif,
    fontSize: 21,
    letterSpacing: -0.4,
    marginTop: 14,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.hand,
    fontSize: 18,
    lineHeight: 21,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyButton: {
    borderRadius: 999,
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  emptyButtonText: {
    fontFamily: fonts.sansBold,
    fontSize: 13.5,
  },
});
