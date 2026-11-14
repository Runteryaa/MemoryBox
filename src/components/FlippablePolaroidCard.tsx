import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, MapPin, RotateCcw, Sparkles } from 'lucide-react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { MOOD_MAP } from '@/constants';
import { formatCoordinates, formatLongDate, formatMediumDate, formatTime } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { contrastInk, fonts, radii, shadows, useTheme } from '@/theme';
import type { Memory } from '@/types';

interface FlippablePolaroidCardProps {
  memory: Memory;
  width?: number;
  developing?: boolean;
  showFavorite?: boolean;
  onToggleFavorite?: () => void;
  editable?: boolean;
  descriptionDraft?: string;
  onDescriptionChange?: (text: string) => void;
  onEditLocation?: () => void;
  onFlipChange?: (flipped: boolean) => void;
  onPressFront?: () => void;
  /** Focus the story input automatically when the card flips to its back. */
  autoFocusStory?: boolean;
  /** Optional external flip state; when it changes the card turns to match. */
  flipped?: boolean;
  rotation?: number;
  initialFlipped?: boolean;
  style?: StyleProp<ViewStyle>;
  showHint?: boolean;
}

export function FlippablePolaroidCard({
  memory,
  width = 300,
  developing = false,
  showFavorite = false,
  onToggleFavorite,
  editable = false,
  descriptionDraft,
  onDescriptionChange,
  onEditLocation,
  onFlipChange,
  onPressFront,
  autoFocusStory = false,
  flipped: flippedProp,
  rotation = 0,
  initialFlipped = false,
  style,
  showHint = true,
}: FlippablePolaroidCardProps) {
  const theme = useTheme();
  const [flipped, setFlipped] = useState(initialFlipped);
  const flip = useSharedValue(initialFlipped ? 1 : 0);
  const develop = useSharedValue(developing ? 0 : 1);
  const storyInputRef = useRef<ComponentRef<typeof TextInput>>(null);

  // Let the parent request a flip (e.g. tapping the "write the story" hint).
  useEffect(() => {
    if (flippedProp === undefined) return;
    setFlipped(flippedProp);
  }, [flippedProp]);

  const scale = Math.max(0.65, width / 300);
  const padding = 11 * scale;
  const photoHeight = (width - padding * 2) * 1.02;
  const bottomMargin = width < 260 ? 54 : 68;
  const cardHeight = photoHeight + padding * 2 + bottomMargin;
  const mood = MOOD_MAP[memory.moodTag] ?? MOOD_MAP.cozy;

  useEffect(() => {
    if (!developing) {
      develop.value = 1;
      return;
    }
    develop.value = 0;
    const timer = setTimeout(() => {
      develop.value = withTiming(1, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [develop, developing, memory.id]);

  useEffect(() => {
    flip.value = withTiming(flipped ? 1 : 0, {
      duration: 540,
      easing: Easing.inOut(Easing.cubic),
    });
    onFlipChange?.(flipped);
    // onFlipChange is intentionally excluded to avoid re-running on identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, flip]);

  // Writing is the whole point of flipping to the back during capture, so open
  // the keyboard once the card has finished turning over.
  useEffect(() => {
    if (!autoFocusStory || !editable || !flipped) return;
    const timer = setTimeout(() => storyInputRef.current?.focus(), 560);
    return () => clearTimeout(timer);
  }, [autoFocusStory, editable, flipped]);

  const flipStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
      { scale: interpolate(flip.value, [0, 0.5, 1], [1, 0.965, 1]) },
    ],
  }));

  const frontOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 0.49, 0.5, 1], [1, 1, 0, 0]),
  }));

  const backOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 0.49, 0.5, 1], [0, 0, 1, 1]),
  }));

  const developOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(develop.value, [0, 1], [1, 0]),
  }));

  const blurOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(develop.value, [0, 0.8, 1], [0.95, 0.25, 0]),
  }));

  const sepiaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(develop.value, [0, 1], [0.55, 0]),
  }));

  const toggleFlip = () => {
    haptics.paperRustle();
    setFlipped((current) => !current);
  };

  const handleFrontPress = () => {
    if (onPressFront) {
      onPressFront();
    } else {
      toggleFlip();
    }
  };

  const description = editable ? descriptionDraft ?? memory.description : memory.description;
  const lineCount = Math.max(4, Math.floor((cardHeight - 138 * scale) / (26 * scale)));
  const lines = useMemo(() => Array.from({ length: lineCount }, (_, index) => index), [lineCount]);

  return (
    <View style={[{ width, height: cardHeight, transform: [{ rotate: `${rotation}deg` }] }, style]}>
      <Animated.View style={[styles.flipper, { width, height: cardHeight }, flipStyle]}>
        {/* FRONT */}
        <Animated.View
          pointerEvents={flipped ? 'none' : 'auto'}
          style={[
            styles.card,
            {
              width,
              height: cardHeight,
              backgroundColor: theme.colors.white,
              borderColor: theme.colors.paperEdge,
              shadowColor: theme.colors.shadow,
            },
            shadows.card,
            frontOpacity,
          ]}
        >
          <View
            style={[
              styles.photoFrame,
              {
                margin: padding,
                marginBottom: 7 * scale,
                height: photoHeight,
                backgroundColor: theme.colors.backgroundAlt,
              },
            ]}
          >
            <Image
              contentFit="cover"
              source={{ uri: memory.imageUri }}
              style={StyleSheet.absoluteFill}
              transition={220}
            />
            <Animated.View style={[StyleSheet.absoluteFill, blurOverlayStyle]}>
              <Image
                blurRadius={26}
                contentFit="cover"
                source={{ uri: memory.imageUri }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: 'rgba(255,238,208,0.9)' },
                developOverlayStyle,
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: '#B45309' },
                sepiaStyle,
              ]}
            />
            <LinearGradient
              colors={['rgba(30,18,10,0)', 'rgba(30,18,10,0.22)']}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { top: '62%' }]}
            />

            <View style={[styles.tape, { backgroundColor: theme.colors.roseSoft }]} />

            {showFavorite ? (
              <Pressable
                accessibilityLabel={
                  memory.isFavorite ? 'Remove from favorites' : 'Add to favorites'
                }
                hitSlop={8}
                onPress={() => {
                  haptics.tap();
                  onToggleFavorite?.();
                }}
                style={[
                  styles.heartButton,
                  { backgroundColor: theme.isDark ? 'rgba(28,25,23,0.7)' : 'rgba(255,255,255,0.88)' },
                ]}
              >
                <Heart
                  color={memory.isFavorite ? theme.colors.rose : theme.colors.inkSoft}
                  fill={memory.isFavorite ? theme.colors.rose : 'transparent'}
                  size={16 * scale}
                  strokeWidth={2.2}
                />
              </Pressable>
            ) : null}

            <View
              style={[
                styles.moodBadge,
                { backgroundColor: theme.isDark ? 'rgba(28,25,23,0.72)' : 'rgba(255,255,255,0.86)' },
              ]}
            >
              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
              <Text style={[styles.moodText, { color: theme.colors.inkSoft }]}>{mood.label}</Text>
            </View>

            {memory.location ? (
              <View
                style={[
                  styles.locationStamp,
                  {
                    backgroundColor: theme.colors.paper,
                    borderColor: theme.colors.stamp,
                  },
                ]}
              >
                <View style={styles.stampHeader}>
                  <MapPin color={theme.colors.stamp} size={9 * scale} strokeWidth={2.6} />
                  <Text style={[styles.stampPostage, { color: theme.colors.stamp }]}>
                    MEMORY POST
                  </Text>
                </View>
                <Text
                  numberOfLines={2}
                  style={[styles.stampPlace, { color: theme.colors.ink }]}
                >
                  {memory.location.placeName}
                </Text>
                {memory.location.city ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.stampCity, { color: theme.colors.stamp }]}
                  >
                    {memory.location.city.toUpperCase()}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={[styles.captionArea, { paddingHorizontal: padding * 1.1 }]}>
            <Text
              numberOfLines={2}
              style={[
                styles.caption,
                { color: theme.colors.ink, fontSize: 24 * scale, lineHeight: 25 * scale },
              ]}
            >
              {memory.shortTitle}
            </Text>
            <View style={styles.captionMeta}>
              <Text style={[styles.dateText, { color: theme.colors.muted, fontSize: 8.5 * scale }]}>
                {formatMediumDate(memory.dateCreated)}
              </Text>
              {showHint && !onPressFront ? (
                <View style={styles.flipHint}>
                  <RotateCcw color={theme.colors.faint} size={9 * scale} strokeWidth={2.4} />
                  <Text
                    style={[
                      styles.flipHintText,
                      { color: theme.colors.faint, fontSize: 8 * scale },
                    ]}
                  >
                    tap to read the story
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Whole card is the flip target, so a stray tap anywhere on the paper works. */}
          <Pressable
            accessibilityLabel="Flip this memory to read the story"
            onPress={handleFrontPress}
            style={[StyleSheet.absoluteFill, styles.frontTapTarget]}
          />
        </Animated.View>

        {/* BACK */}
        <Animated.View
          pointerEvents={flipped ? 'auto' : 'none'}
          style={[
            styles.card,
            styles.backCard,
            {
              width,
              height: cardHeight,
              backgroundColor: theme.colors.paper,
              borderColor: theme.colors.paperEdge,
              shadowColor: theme.colors.shadow,
              transform: [{ rotateY: '180deg' }],
            },
            shadows.card,
            backOpacity,
          ]}
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {lines.map((line) => (
              <View
                key={line}
                style={[
                  styles.paperLine,
                  {
                    backgroundColor: theme.colors.paperLines,
                    top: 138 * scale + line * 26 * scale,
                  },
                ]}
              />
            ))}
            <View
              style={[
                styles.paperMargin,
                { backgroundColor: theme.colors.rose, top: 0, bottom: 0 },
              ]}
            />
          </View>

          <View style={[styles.backHeader, { padding: padding * 1.2 }]}>
            <View style={styles.backHeaderLeft}>
              <Text style={[styles.backKicker, { color: theme.colors.rose }]}>the story behind</Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.backTitle,
                  { color: theme.colors.ink, fontSize: 20 * scale, lineHeight: 22 * scale },
                ]}
              >
                {memory.shortTitle}
              </Text>
              <View style={styles.backMetaRow}>
                <Text style={[styles.backMeta, { color: theme.colors.muted }]}>
                  {formatLongDate(memory.dateCreated)}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.postageStamp,
                {
                  width: 78 * scale,
                  height: 88 * scale,
                  backgroundColor: theme.colors.stampSoft,
                  borderColor: theme.colors.stamp,
                },
              ]}
            >
              <View style={styles.stampBurst}>
                <Sparkles color={theme.colors.stamp} size={11 * scale} strokeWidth={2} />
              </View>
              <Text style={[styles.postageTop, { color: theme.colors.stamp }]}>MEMORY BOX</Text>
              <Text style={[styles.postageDate, { color: theme.colors.ink }]}>
                {formatMediumDate(memory.dateCreated)}
              </Text>
              <Text style={[styles.postageCoords, { color: theme.colors.stamp }]}>
                {memory.location
                  ? formatCoordinates(memory.location.latitude, memory.location.longitude)
                  : 'TUCKED AWAY WITH LOVE'}
              </Text>
              <Text style={[styles.postageValue, { color: theme.colors.rose }]}>
                {mood.emoji} {mood.label.toUpperCase()}
              </Text>
            </View>
          </View>

          {editable ? (
            <ScrollView
              contentContainerStyle={[
                styles.storyScrollContent,
                { paddingHorizontal: 20 * scale },
              ]}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              style={styles.storyScroll}
            >
              <TextInput
                maxLength={1500}
                multiline
                ref={storyInputRef}
                onChangeText={onDescriptionChange}
                placeholder="Write down everything you never want to forget… how the light looked, what it smelled like, how you felt."
                placeholderTextColor={theme.colors.faint}
                scrollEnabled={false}
                style={[
                  styles.storyInput,
                  {
                    color: theme.colors.ink,
                    fontSize: 19 * scale,
                    lineHeight: 26 * scale,
                  },
                ]}
                textAlignVertical="top"
                value={description}
              />
              <Text style={[styles.charCount, { color: theme.colors.faint }]}>
                {(description ?? '').length} / 1500
              </Text>
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={[
                styles.storyScrollContent,
                { paddingHorizontal: 20 * scale },
              ]}
              showsVerticalScrollIndicator={false}
              style={styles.storyScroll}
            >
              <Text
                style={[
                  styles.storyText,
                  {
                    color: theme.colors.inkSoft,
                    fontSize: 19 * scale,
                    lineHeight: 26 * scale,
                  },
                ]}
              >
                {memory.description || 'No story written yet — just a feeling kept safe.'}
              </Text>
              <Text style={[styles.signature, { color: theme.colors.muted }]}>
                tucked in at {formatTime(memory.dateCreated)}
              </Text>
            </ScrollView>
          )}

          <View style={[styles.backFooter, { paddingHorizontal: 18 * scale, paddingBottom: 12 * scale }]}>
            {memory.location ? (
              <Pressable
                accessibilityLabel="Edit this memory's location"
                disabled={!onEditLocation}
                onPress={() => {
                  haptics.tap();
                  onEditLocation?.();
                }}
                style={[
                  styles.backLocationPill,
                  {
                    backgroundColor: theme.colors.sageSoft,
                    borderColor: theme.colors.sage,
                  },
                ]}
              >
                <MapPin color={theme.colors.sage} size={10 * scale} strokeWidth={2.6} />
                <Text
                  numberOfLines={1}
                  style={[styles.backLocationText, { color: theme.colors.sage }]}
                >
                  {memory.location.placeName}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityLabel="Add a location to this memory"
                disabled={!onEditLocation}
                onPress={() => {
                  haptics.tap();
                  onEditLocation?.();
                }}
                style={[
                  styles.backLocationPill,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderStrong },
                ]}
              >
                <MapPin color={theme.colors.muted} size={10 * scale} strokeWidth={2.4} />
                <Text style={[styles.backLocationText, { color: theme.colors.muted }]}>
                  add a place
                </Text>
              </Pressable>
            )}

            <Pressable
              accessibilityLabel="Flip back to the photo"
              onPress={() => {
                haptics.paperRustle();
                setFlipped(false);
              }}
              style={[
                styles.backFlipButton,
                { backgroundColor: theme.colors.rose, borderColor: theme.colors.roseDeep },
              ]}
            >
              <RotateCcw color={contrastInk(theme.colors.rose)} size={11 * scale} strokeWidth={2.6} />
              <Text
                style={[
                  styles.backFlipText,
                  { color: contrastInk(theme.colors.rose), fontSize: 9.5 * scale },
                ]}
              >
                see photo
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flipper: {
    position: 'relative',
  },
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 6,
    borderWidth: 1,
    backfaceVisibility: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 10,
  },
  backCard: {
    overflow: 'hidden',
  },
  frontTapTarget: {
    zIndex: 1,
  },
  photoFrame: {
    borderRadius: 2,
    overflow: 'hidden',
  },
  tape: {
    position: 'absolute',
    top: -8,
    left: '38%',
    width: '24%',
    height: 16,
    opacity: 0.85,
    transform: [{ rotate: '-3deg' }],
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  moodBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 4,
  },
  moodEmoji: {
    fontSize: 10,
  },
  moodText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 8.5,
    letterSpacing: 0.2,
  },
  locationStamp: {
    position: 'absolute',
    right: 9,
    bottom: 9,
    width: '53%',
    borderRadius: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 7,
    paddingVertical: 5,
    transform: [{ rotate: '-2.4deg' }],
    zIndex: 4,
  },
  stampHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    marginBottom: 1,
  },
  stampPostage: {
    fontFamily: fonts.sansBold,
    fontSize: 6.2,
    letterSpacing: 1,
  },
  stampPlace: {
    fontFamily: fonts.handBold,
    fontSize: 14,
    lineHeight: 14,
  },
  stampCity: {
    fontFamily: fonts.sansBold,
    fontSize: 6.4,
    letterSpacing: 0.7,
    marginTop: 1,
  },
  captionArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    fontFamily: fonts.handBold,
    textAlign: 'center',
  },
  captionMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 3,
  },
  dateText: {
    fontFamily: fonts.sansSemiBold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  flipHint: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  flipHintText: {
    fontFamily: fonts.sans,
    letterSpacing: 0.2,
  },
  paperLine: {
    position: 'absolute',
    left: 20,
    right: 16,
    height: StyleSheet.hairlineWidth,
    opacity: 0.8,
  },
  paperMargin: {
    position: 'absolute',
    left: 12,
    width: 1.5,
    opacity: 0.28,
  },
  backHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 4,
  },
  backHeaderLeft: {
    flex: 1,
    paddingTop: 2,
  },
  backKicker: {
    fontFamily: fonts.handBold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  backTitle: {
    fontFamily: fonts.handBold,
    marginTop: -1,
  },
  backMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  backMeta: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 7.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  postageStamp: {
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderRadius: 2,
    padding: 5,
    transform: [{ rotate: '3deg' }],
    marginTop: 2,
  },
  stampBurst: {
    position: 'absolute',
    right: 4,
    top: 4,
    opacity: 0.7,
  },
  postageTop: {
    fontFamily: fonts.sansBold,
    fontSize: 6,
    letterSpacing: 1.3,
  },
  postageDate: {
    fontFamily: fonts.serifRegular,
    fontSize: 10,
    marginTop: 2,
  },
  postageCoords: {
    fontFamily: fonts.sans,
    fontSize: 5.4,
    letterSpacing: 0.2,
    marginTop: 2,
    lineHeight: 7,
  },
  postageValue: {
    fontFamily: fonts.sansBold,
    fontSize: 5.5,
    letterSpacing: 0.5,
    marginTop: 'auto',
  },
  storyScroll: {
    flex: 1,
    marginTop: 2,
  },
  storyScrollContent: {
    paddingBottom: 4,
  },
  storyText: {
    fontFamily: fonts.hand,
  },
  storyInput: {
    fontFamily: fonts.hand,
    minHeight: 120,
    padding: 0,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontFamily: fonts.sansSemiBold,
    fontSize: 8,
    marginTop: 2,
  },
  signature: {
    alignSelf: 'flex-end',
    fontFamily: fonts.hand,
    fontSize: 14,
    marginTop: 8,
  },
  backFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  backLocationPill: {
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    flexShrink: 1,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backLocationText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 8.5,
    maxWidth: 110,
  },
  backFlipButton: {
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  backFlipText: {
    fontFamily: fonts.sansBold,
    letterSpacing: 0.2,
  },
});
