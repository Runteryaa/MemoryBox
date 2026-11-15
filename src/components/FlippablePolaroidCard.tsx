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
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MAX_DESCRIPTION_LENGTH, MOOD_MAP } from '@/constants';
import { formatCoordinates, formatLongDate, formatMediumDate, formatTime } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { cachedImageRatio, rememberImageRatio } from '@/lib/imageRatio';
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
  /** Hard ceiling for the whole card; the photo frame shrinks to respect it. */
  maxHeight?: number;
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
  maxHeight,
}: FlippablePolaroidCardProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(initialFlipped);
  const flip = useSharedValue(initialFlipped ? 1 : 0);
  const develop = useSharedValue(developing ? 0 : 1);
  const heart = useSharedValue(1);
  const storyInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [photoRatio, setPhotoRatio] = useState<number | null>(() => {
    if (memory.imageWidth && memory.imageHeight) {
      return memory.imageHeight / memory.imageWidth;
    }
    // Older keepsakes have no recorded size, but if this photo has already been
    // decoded this session its shape is known.
    return cachedImageRatio(memory.imageUri);
  });

  // A new memory means a new photo; clear any previous failure and shape.
  useEffect(() => {
    setImageFailed(false);
    // The shape recorded at capture time is known immediately, so the card is
    // framed correctly from the first frame instead of jumping on decode.
    const stored =
      memory.imageWidth && memory.imageHeight
        ? memory.imageHeight / memory.imageWidth
        : cachedImageRatio(memory.imageUri);
    setPhotoRatio(stored);
  }, [memory.imageHeight, memory.imageUri, memory.imageWidth]);

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heart.value }],
  }));

  const popHeart = () => {
    if (reducedMotion) return;
    heart.value = withSequence(
      withTiming(1.32, { duration: 105 }),
      withSpring(1, { damping: 9, stiffness: 250 })
    );
  };

  // Let the parent request a flip (e.g. tapping the "write the story" hint).
  useEffect(() => {
    if (flippedProp === undefined) return;
    setFlipped(flippedProp);
  }, [flippedProp]);

  const scale = Math.max(0.65, width / 300);
  const padding = 11 * scale;
  const photoWidth = width - padding * 2;
  // The frame follows the photo's own shape once it has loaded, so a wide
  // landscape and a tall portrait both feel kept rather than force-cropped.
  // The clamp keeps the card from ever towering off-screen.
  const bottomMargin = width < 260 ? 54 : 68;
  const tallestPhoto = maxHeight == null ? Infinity : Math.max(90, maxHeight - padding * 2 - bottomMargin);
  const ratioCeiling = Math.min(1.3, tallestPhoto / Math.max(photoWidth, 1));
  const ratioFloor = Math.min(0.76, ratioCeiling);
  const ratio = photoRatio == null
    ? Math.min(1.02, ratioCeiling)
    : Math.min(ratioCeiling, Math.max(ratioFloor, photoRatio));
  const photoHeight = Math.min(tallestPhoto, photoWidth * ratio);
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
    // Turning a card through the air is a big, sweeping motion. A reader who
    // asked for less simply gets the other side, without the flight.
    flip.value = withTiming(flipped ? 1 : 0, {
      duration: reducedMotion ? 0 : 540,
      easing: Easing.inOut(Easing.cubic),
    });
    onFlipChange?.(flipped);
    // onFlipChange is intentionally excluded to avoid re-running on identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped, flip, reducedMotion]);

  // Writing is the whole point of flipping to the back during capture, so open
  // the keyboard once the card has finished turning over.
  useEffect(() => {
    if (!autoFocusStory || !editable || !flipped) return;
    const timer = setTimeout(() => storyInputRef.current?.focus(), reducedMotion ? 60 : 560);
    return () => clearTimeout(timer);
  }, [autoFocusStory, editable, flipped, reducedMotion]);

  const flipStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      // The card lifts a little as it turns, like a photo held between two fingers.
      { translateY: interpolate(flip.value, [0, 0.5, 1], [0, -7, 0]) },
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

  // A sheen sweeps across the paper as the card turns, as if it caught the light.
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flip.value, [0, 0.25, 0.5, 0.75, 1], [0, 0.5, 0.75, 0.4, 0]),
    transform: [
      { translateX: interpolate(flip.value, [0, 1], [-width * 1.1, width * 1.1]) },
      { rotate: '16deg' },
    ],
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
  // A stamp with only a city (or only a pin) should still say something.
  const placeLabel =
    memory.location?.placeName?.trim() || memory.location?.city?.trim() || '';
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
              backgroundColor: theme.colors.photoPaper,
              borderColor: theme.colors.paperEdge,
              shadowColor: theme.colors.shadow,
            },
            shadows.card,
            frontOpacity,
          ]}
        >
          {/* Whole card is the tap target. It sits underneath the photo and
              caption so the favourite heart above it still gets its own taps. */}
          <Pressable
            accessibilityLabel={
              onPressFront
                ? `Open memory ${memory.shortTitle}`
                : `Flip ${memory.shortTitle} to read the story`
            }
            onPress={handleFrontPress}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="box-none"
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
              cachePolicy="memory-disk"
              contentFit="cover"
              onError={() => setImageFailed(true)}
              pointerEvents="none"
              onLoad={(event) => {
                const { width: photoPixelWidth, height: photoPixelHeight } = event.source;
                if (!photoPixelWidth || !photoPixelHeight) return;
                const next = photoPixelHeight / photoPixelWidth;
                rememberImageRatio(memory.imageUri, next);
                setPhotoRatio((current) =>
                  current != null && Math.abs(current - next) < 0.01 ? current : next
                );
              }}
              source={{ uri: memory.imageUri }}
              style={StyleSheet.absoluteFill}
              transition={220}
            />
            {imageFailed ? (
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, styles.missingPhoto]}
              >
                <RotateCcw color={theme.colors.faint} size={22 * scale} strokeWidth={2} />
                <Text style={[styles.missingText, { color: theme.colors.faint, fontSize: 9 * scale }]}>
                  the photo drifted away
                </Text>
              </Animated.View>
            ) : null}
            {/* The blurred duplicate is only needed while the photo is still
                developing — keeping it mounted forever doubles the decode cost
                of every card in the gallery. */}
            {developing ? (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, blurOverlayStyle]}>
                <Image
                  blurRadius={26}
                  contentFit="cover"
                  source={{ uri: memory.imageUri }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            ) : null}
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
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(60,40,25,0.1)']}
              end={{ x: 0.75, y: 1 }}
              locations={[0, 0.45, 1]}
              pointerEvents="none"
              start={{ x: 0.2, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(30,18,10,0)', 'rgba(30,18,10,0.22)']}
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { top: '62%' }]}
            />

            <View pointerEvents="none" style={[styles.tape, { backgroundColor: theme.colors.roseSoft }]} />

            {showFavorite ? (
              <Pressable
                accessibilityLabel={
                  memory.isFavorite ? 'Remove from favorites' : 'Add to favorites'
                }
                accessibilityRole="button"
                accessibilityState={{ selected: memory.isFavorite }}
                hitSlop={8}
                onPress={() => {
                  haptics.tap();
                  popHeart();
                  onToggleFavorite?.();
                }}
                style={[
                  styles.heartButton,
                  { backgroundColor: theme.isDark ? 'rgba(28,25,23,0.7)' : 'rgba(255,255,255,0.88)' },
                ]}
              >
                <Animated.View style={heartStyle}>
                  <Heart
                    color={memory.isFavorite ? theme.colors.rose : theme.colors.inkSoft}
                    fill={memory.isFavorite ? theme.colors.rose : 'transparent'}
                    size={16 * scale}
                    strokeWidth={2.2}
                  />
                </Animated.View>
              </Pressable>
            ) : null}

            <View
              pointerEvents="none"
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
                pointerEvents="none"
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
                  {placeLabel || 'somewhere worth keeping'}
                </Text>
                {memory.location.city && memory.location.city.trim() !== placeLabel ? (
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

          <View
            pointerEvents="none"
            style={[styles.captionArea, { paddingHorizontal: padding * 1.1 }]}
          >
            <Text
              maxFontSizeMultiplier={1.15}
              numberOfLines={2}
              style={[
                styles.caption,
                { color: theme.colors.photoInk, fontSize: 24 * scale, lineHeight: 25 * scale },
              ]}
            >
              {memory.shortTitle}
            </Text>
            <View style={styles.captionMeta}>
              <Text
                maxFontSizeMultiplier={1.3}
                style={[styles.dateText, { color: theme.colors.photoInkSoft, fontSize: 8.5 * scale }]}
              >
                {formatMediumDate(memory.dateCreated)}
              </Text>
              {showHint && !onPressFront ? (
                <View style={styles.flipHint}>
                  <RotateCcw color={theme.colors.photoInkSoft} size={9 * scale} strokeWidth={2.4} />
                  <Text
                    maxFontSizeMultiplier={1.3}
                    style={[
                      styles.flipHintText,
                      { color: theme.colors.photoInkSoft, fontSize: 8 * scale },
                    ]}
                  >
                    tap to read the story
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.paperGloss]} />
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
                accessibilityLabel="The story on the back of this memory"
                maxFontSizeMultiplier={1.25}
                maxLength={MAX_DESCRIPTION_LENGTH}
                multiline
                ref={storyInputRef}
                onChangeText={onDescriptionChange}
                placeholder="Write down everything you never want to forget… how the light looked, what it smelled like, how you felt."
                placeholderTextColor={theme.colors.faint}
                scrollEnabled={false}
                selectionColor={theme.colors.rose}
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
              {/* Like the composer, the count only shows once there are words
                  to count, and warms as the space runs low. */}
              <Text
                style={[
                  styles.charCount,
                  {
                    color:
                      (description ?? '').length >= MAX_DESCRIPTION_LENGTH - 40
                        ? theme.colors.amber
                        : theme.colors.faint,
                    opacity: (description ?? '').length > 0 ? 1 : 0,
                  },
                ]}
              >
                {(description ?? '').length} / {MAX_DESCRIPTION_LENGTH}
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
                  {placeLabel || 'a place worth keeping'}
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

      {/* A thin band of light skates over the paper while the card turns over. */}
      <View pointerEvents="none" style={styles.sheenMask}>
        <Animated.View style={[styles.sheen, sheenStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flipper: {
    position: 'relative',
  },
  sheenMask: {
    borderRadius: 6,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheen: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    bottom: -40,
    position: 'absolute',
    top: -40,
    width: 46,
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
  paperGloss: {
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 6,
    borderWidth: 1,
  },
  photoFrame: {
    borderRadius: 2,
    overflow: 'hidden',
  },
  missingPhoto: {
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
  },
  missingText: {
    fontFamily: fonts.hand,
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
