import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, type CameraType, type FlashMode } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  ArrowDown,
  Camera,
  Check,
  ChevronLeft,
  Images,
  MapPin,
  SwitchCamera,
  X,
  Zap,
  ZapOff,
} from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FlippablePolaroidCard } from '@/components/FlippablePolaroidCard';
import { LocationStampPicker } from '@/components/LocationStampPicker';
import { SparkleBurst } from '@/components/SkiaParticles';
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH, MOODS } from '@/constants';
import { formatMediumDate } from '@/lib/date';
import { haptics } from '@/lib/haptics';
import { persistMemoryImage, deleteMemoryImage } from '@/services/fileStorage';
import {
  createMemoryLocation,
  detectCurrentPlace,
  extractExifDate,
  extractExifLocation,
} from '@/services/locationService';
import { useMemoryStore } from '@/store/useMemoryStore';
import { contrastInk, fonts, radii, shadows, useTheme } from '@/theme';
import type { MemoryLocation, MoodTag } from '@/types';

type Step = 'camera' | 'arrange';

interface CapturedPhoto {
  uri: string;
  dateCreated: string;
}

export default function CaptureScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const addMemory = useMemoryStore((state) => state.addMemory);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [step, setStep] = useState<Step>('camera');
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [taking, setTaking] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mood, setMood] = useState<MoodTag>('cozy');
  const [location, setLocation] = useState<MemoryLocation | null>(null);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [developing, setDeveloping] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);

  const locationTouched = useRef(false);
  const savedRef = useRef(false);
  const draftUriRef = useRef<string | null>(null);
  const dragY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const dragRotate = useSharedValue(0);
  const lidOpen = useSharedValue(0);
  const [burstKey, setBurstKey] = useState(0);

  const cardWidth = Math.min(300, width - 68);

  // Abandoned drafts should not leave orphaned photos in the document folder.
  useEffect(
    () => () => {
      if (savedRef.current) return;
      const draft = draftUriRef.current;
      if (draft) void deleteMemoryImage(draft);
    },
    []
  );

  const autoDetect = useCallback(() => {
    if (locationTouched.current) return;
    void detectCurrentPlace()
      .then((place) => {
        if (!locationTouched.current) setLocation(place);
      })
      .catch(() => {
        // A memory without a place is still a lovely memory.
      });
  }, []);

  const adoptPhoto = useCallback(
    async (sourceUri: string, exif: Record<string, unknown> | null, fromCamera: boolean) => {
      const storedUri = await persistMemoryImage(sourceUri);
      const previousDraft = draftUriRef.current;
      draftUriRef.current = storedUri;
      if (previousDraft && previousDraft !== storedUri) {
        void deleteMemoryImage(previousDraft);
      }
      setPhoto({ uri: storedUri, dateCreated: extractExifDate(exif) ?? new Date().toISOString() });
      setTitle('');
      setDescription('');
      setMood('cozy');
      setLocation(null);
      setCardFlipped(false);
      locationTouched.current = false;
      savedRef.current = false;
      setSaved(false);
      setStep('arrange');
      setDeveloping(fromCamera);
      if (fromCamera) {
        setTimeout(() => setDeveloping(false), 1750);
      }

      const exifCoords = extractExifLocation(exif);
      if (exifCoords) {
        try {
          const place = await createMemoryLocation(exifCoords.latitude, exifCoords.longitude);
          if (!locationTouched.current) setLocation(place);
        } catch {
          autoDetect();
        }
      } else {
        autoDetect();
      }
    },
    [autoDetect]
  );

  const takePicture = useCallback(async () => {
    if (taking || !cameraRef.current) return;
    setTaking(true);
    haptics.medium();
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.86,
        exif: true,
      });
      if (!picture?.uri) throw new Error('No photo returned');
      await adoptPhoto(
        picture.uri,
        (picture.exif as Record<string, unknown> | null) ?? null,
        true
      );
      haptics.success();
    } catch {
      setCameraError('The camera stumbled. Try again, or pick a photo from your library.');
      haptics.error();
    } finally {
      setTaking(false);
    }
  }, [adoptPhoto, taking]);

  const pickFromLibrary = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    haptics.soft();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        exif: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      await adoptPhoto(asset.uri, (asset.exif as Record<string, unknown> | null) ?? null, false);
      haptics.success();
    } catch {
      haptics.error();
    } finally {
      setBusy(false);
    }
  }, [adoptPhoto, busy]);

  const finishCapture = useCallback(() => {
    if (savedRef.current || !photo) return;
    savedRef.current = true;
    setSaved(true);
    setBurstKey((key) => key + 1);
    haptics.success();

    const input = {
      imageUri: photo.uri,
      shortTitle: title.trim() || 'A little moment',
      description: description.trim().slice(0, MAX_DESCRIPTION_LENGTH),
      location,
      dateCreated: photo.dateCreated,
      moodTag: mood,
    };

    setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
      setTimeout(() => {
        addMemory(input);
      }, 220);
    }, 260);
  }, [addMemory, description, location, mood, photo, title]);

  const dropIntoBox = useCallback(() => {
    if (savedRef.current) return;
    dragY.value = withTiming(360, { duration: 430, easing: Easing.in(Easing.cubic) });
    dragScale.value = withTiming(0.18, { duration: 430, easing: Easing.in(Easing.cubic) });
    dragRotate.value = withTiming(9, { duration: 430 });
    lidOpen.value = withSequence(
      withTiming(1, { duration: 170 }),
      withTiming(1, { duration: 260 }),
      withTiming(0, { duration: 180 })
    );
    setTimeout(finishCapture, 400);
  }, [dragRotate, dragScale, dragY, finishCapture, lidOpen]);

  const dragGesture = Gesture.Pan()
    .enabled(!cardFlipped)
    .activeOffsetY(14)
    .failOffsetX([-36, 36])
    .onUpdate((event) => {
      if (event.translationY < 0) return;
      dragY.value = event.translationY;
      dragScale.value = interpolate(event.translationY, [0, 220], [1, 0.72], 'clamp');
      dragRotate.value = interpolate(event.translationY, [0, 220], [0, 6], 'clamp');
      lidOpen.value = interpolate(event.translationY, [70, 170], [0, 1], 'clamp');
    })
    .onEnd((event) => {
      if (event.translationY > 110 || event.velocityY > 750) {
        runOnJS(dropIntoBox)();
        return;
      }
      dragY.value = withSpring(0, { damping: 16, stiffness: 200 });
      dragScale.value = withSpring(1, { damping: 16, stiffness: 200 });
      dragRotate.value = withSpring(0, { damping: 16, stiffness: 200 });
      lidOpen.value = withTiming(0, { duration: 180 });
    });

  const cardDragStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: dragY.value },
      { scale: dragScale.value },
      { rotate: `${dragRotate.value}deg` },
    ],
  }));

  const lidStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 500 },
      { translateY: lidOpen.value * -4 },
      { rotateX: `${-100 * lidOpen.value}deg` },
    ],
  }));

  const boxGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lidOpen.value, [0, 1], [0, 0.8]),
  }));

  const discardDraft = () => {
    if (savedRef.current) return;
    const draft = draftUriRef.current;
    draftUriRef.current = null;
    if (draft) void deleteMemoryImage(draft);
  };

  const resetToCamera = () => {
    haptics.tap();
    discardDraft();
    if (photo) {
      setPhoto(null);
      setDeveloping(false);
    }
    setCardFlipped(false);
    setStep('camera');
  };

  const close = () => {
    haptics.tap();
    discardDraft();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const flashIcon = flash === 'off' ? ZapOff : Zap;

  return (
    <View style={[styles.root, { backgroundColor: '#171310' }]}>
      {step === 'camera' ? (
        <View style={styles.cameraRoot}>
          {permission?.granted ? (
            <CameraView
              facing={facing}
              flash={flash}
              mode="picture"
              onMountError={(event) => setCameraError(event.message)}
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <LinearGradient colors={['#2A211B', '#171310']} style={StyleSheet.absoluteFill} />
          )}

          <LinearGradient
            colors={['rgba(12,9,7,0.72)', 'rgba(12,9,7,0)']}
            pointerEvents="none"
            style={styles.topShade}
          />
          <LinearGradient
            colors={['rgba(12,9,7,0)', 'rgba(12,9,7,0.85)']}
            pointerEvents="none"
            style={styles.bottomShade}
          />

          <View style={[styles.cameraTop, { paddingTop: insets.top + 6 }]}>
            <IconButton
              accessibilityLabel="Close camera"
              backgroundColor="rgba(28,25,23,0.55)"
              borderColor="rgba(255,255,255,0.16)"
              color="#FFFFFF"
              icon={X}
              onPress={close}
            />
            <View style={styles.cameraTopRight}>
              <IconButton
                accessibilityLabel={`Flash is ${flash}`}
                backgroundColor="rgba(28,25,23,0.55)"
                borderColor="rgba(255,255,255,0.16)"
                color={flash === 'off' ? '#FFFFFF' : theme.colors.gold}
                icon={flashIcon}
                onPress={() => {
                  haptics.tap();
                  setFlash((current) => (current === 'off' ? 'on' : current === 'on' ? 'auto' : 'off'));
                }}
              />
              <IconButton
                accessibilityLabel="Switch camera"
                backgroundColor="rgba(28,25,23,0.55)"
                borderColor="rgba(255,255,255,0.16)"
                color="#FFFFFF"
                icon={SwitchCamera}
                onPress={() => {
                  haptics.tap();
                  setFacing((current) => (current === 'back' ? 'front' : 'back'));
                }}
              />
            </View>
          </View>

          <View style={styles.cameraCenter}>
            {!permission?.granted ? (
              <View style={styles.permissionCard}>
                <Text style={styles.permissionEmoji}>📷</Text>
                <Text style={styles.permissionTitle}>Let&apos;s open the camera</Text>
                <Text style={styles.permissionText}>
                  Memory Box needs a peek through your lens to capture the moment. You can also pick a
                  photo you already love.
                </Text>
                <PressableScale
                  accessibilityLabel="Allow camera access"
                  haptic="medium"
                  onPress={() => {
                    void requestPermission();
                  }}
                  style={styles.permissionButton}
                >
                  <Text style={styles.permissionButtonText}>Allow camera</Text>
                </PressableScale>
              </View>
            ) : null}
          </View>

          {cameraError ? (
            <Animated.View entering={FadeIn} style={styles.cameraError}>
              <Text style={styles.cameraErrorText}>{cameraError}</Text>
            </Animated.View>
          ) : null}

          <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.cameraBottomSide}>
              <PressableScale
                accessibilityLabel="Pick a photo from your library"
                haptic="soft"
                onPress={() => {
                  void pickFromLibrary();
                }}
                style={styles.rollButton}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Images color="#FFFFFF" size={21} strokeWidth={2.2} />
                )}
              </PressableScale>
              <Text style={styles.rollLabel}>library</Text>
            </View>

            <PressableScale
              accessibilityLabel="Take a photo"
              disabled={!permission?.granted || taking}
              haptic="none"
              onPress={() => {
                void takePicture();
              }}
              scaleTo={0.9}
              style={styles.shutterOuter}
            >
              <View style={styles.shutterInner}>
                {taking ? (
                  <ActivityIndicator color={theme.colors.rose} size="small" />
                ) : (
                  <Camera color={theme.colors.rose} size={24} strokeWidth={2.2} />
                )}
              </View>
            </PressableScale>

            <View style={styles.cameraBottomSide}>
              <PressableScale
                accessibilityLabel="Use the camera roll instead"
                haptic="soft"
                onPress={close}
                style={styles.rollButton}
              >
                <X color="#FFFFFF" size={20} strokeWidth={2.2} />
              </PressableScale>
              <Text style={styles.rollLabel}>cancel</Text>
            </View>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.arrangeRoot}
        >
          <LinearGradient
            colors={theme.gradients.screen}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.55, 1]}
            start={{ x: 0.15, y: 0 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.arrangeHeader, { paddingTop: insets.top + 6 }]}>
            <IconButton
              accessibilityLabel="Retake the photo"
              backgroundColor={theme.colors.surface}
              borderColor={theme.colors.border}
              icon={ChevronLeft}
              onPress={resetToCamera}
            />
            <View style={styles.arrangeHeaderCopy}>
              <Text style={[styles.arrangeKicker, { color: theme.colors.rose }]}>
                {saved ? 'tucked away' : 'almost home'}
              </Text>
              <Text style={[styles.arrangeTitle, { color: theme.colors.ink }]}>
                {saved ? 'Safe in your box' : 'Make it a keepsake'}
              </Text>
            </View>
            <IconButton
              accessibilityLabel="Tuck this memory into the box"
              backgroundColor={theme.colors.rose}
              borderColor={theme.colors.roseDeep}
              color={contrastInk(theme.colors.rose)}
              disabled={saved}
              icon={Check}
              onPress={() => {
                dropIntoBox();
              }}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.arrangeScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(360)}>
              <Text style={[styles.hint, { color: theme.colors.muted }]}>
                {photo ? formatMediumDate(photo.dateCreated) : ''} · tap the photo to flip it
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(400).delay(40)} style={styles.titleWrap}>
              <TextInput
                maxLength={MAX_TITLE_LENGTH}
                onChangeText={setTitle}
                placeholder="Name this moment…"
                placeholderTextColor={theme.colors.faint}
                style={[
                  styles.titleInput,
                  { color: theme.colors.ink, borderColor: theme.colors.borderStrong },
                ]}
                value={title}
              />
              <Text style={[styles.titleCount, { color: theme.colors.faint }]}>
                {title.length}/{MAX_TITLE_LENGTH}
              </Text>
            </Animated.View>

            {photo ? (
              <Animated.View entering={FadeInDown.duration(440).delay(80)} style={styles.cardStage}>
                <GestureDetector gesture={dragGesture}>
                  <Animated.View style={cardDragStyle}>
                    <FlippablePolaroidCard
                      developing={developing}
                      editable
                      memory={{
                        id: 'draft',
                        imageUri: photo.uri,
                        shortTitle: title.trim() || 'A little moment',
                        description,
                        location,
                        dateCreated: photo.dateCreated,
                        moodTag: mood,
                        rotationAngle: 0,
                        isFavorite: false,
                      }}
                      onDescriptionChange={setDescription}
                      onEditLocation={() => {
                        locationTouched.current = true;
                        setLocationPickerOpen(true);
                      }}
                      onFlipChange={setCardFlipped}
                      width={cardWidth}
                    />
                  </Animated.View>
                </GestureDetector>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.duration(460).delay(120)} style={styles.controls}>
              <PressableScale
                accessibilityLabel="Change this memory's place"
                haptic="tap"
                onPress={() => {
                  locationTouched.current = true;
                  setLocationPickerOpen(true);
                }}
                style={[
                  styles.locationPill,
                  {
                    backgroundColor: location ? theme.colors.sageSoft : theme.colors.surface,
                    borderColor: location ? theme.colors.sage : theme.colors.borderStrong,
                  },
                ]}
              >
                <MapPin
                  color={location ? theme.colors.sage : theme.colors.muted}
                  size={14}
                  strokeWidth={2.5}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.locationText,
                    { color: location ? theme.colors.sage : theme.colors.muted },
                  ]}
                >
                  {location ? location.placeName : 'Add the place it happened'}
                </Text>
                <Text style={[styles.locationEdit, { color: theme.colors.faint }]}>edit</Text>
              </PressableScale>

              <Text style={[styles.moodLabel, { color: theme.colors.muted }]}>how did it feel?</Text>
              <View style={styles.moodRow}>
                {MOODS.map((option) => {
                  const active = mood === option.id;
                  return (
                    <PressableScale
                      accessibilityLabel={`${option.label} mood`}
                      haptic="selection"
                      key={option.id}
                      onPress={() => setMood(option.id)}
                      style={[
                        styles.moodChip,
                        {
                          backgroundColor: active ? option.soft : theme.colors.surface,
                          borderColor: active ? option.color : theme.colors.border,
                          transform: [{ scale: active ? 1.04 : 1 }],
                        },
                      ]}
                    >
                      <Text style={styles.moodEmoji}>{option.emoji}</Text>
                      <Text
                        style={[
                          styles.moodText,
                          { color: active ? option.color : theme.colors.muted },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              <View style={styles.storyHintRow}>
                <Text style={[styles.storyHint, { color: theme.colors.muted }]}>
                  flipped to the back? write the story there.
                </Text>
                <Text style={[styles.storyCount, { color: theme.colors.faint }]}>
                  {description.length}/{MAX_DESCRIPTION_LENGTH}
                </Text>
              </View>
            </Animated.View>
          </ScrollView>

          <View style={[styles.dropZone, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.dropHintWrap}>
              <ArrowDown color={theme.colors.faint} size={13} strokeWidth={2.4} />
              <Text style={[styles.dropHint, { color: theme.colors.muted }]}>
                drag the photo down to tuck it in
              </Text>
            </View>

            <View style={styles.dropBoxWrap}>
              <SparkleBurst burstKey={burstKey} particleCount={26} />
              <View style={[styles.dropShadow, { backgroundColor: theme.colors.shadow }]} />
              <View
                style={[
                  styles.dropBox,
                  {
                    backgroundColor: theme.colors.boxBaseDeep,
                    borderColor: theme.colors.boxInside,
                  },
                ]}
              >
                <LinearGradient
                  colors={theme.gradients.box}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.dropInside, { backgroundColor: theme.colors.boxInside }]}>
                  <Animated.View
                    style={[styles.dropInsideGlow, { backgroundColor: theme.colors.amber }, boxGlowStyle]}
                  />
                </View>
                <View style={[styles.dropRibbon, { backgroundColor: theme.colors.ribbon }]} />
                <Text style={[styles.dropLabel, { color: theme.colors.roseDeep }]}>memory box</Text>
              </View>

              <Animated.View
                style={[
                  styles.dropLid,
                  {
                    borderColor: theme.colors.boxLidDeep,
                    transformOrigin: 'bottom',
                  },
                  lidStyle,
                ]}
              >
                <LinearGradient
                  colors={theme.gradients.lid}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={[StyleSheet.absoluteFill, styles.dropLidGradient]}
                />
                <View style={[styles.dropLidRibbon, { backgroundColor: theme.colors.ribbon }]} />
                <Text style={[styles.dropLidText, { color: theme.colors.roseDeep }]}>our little</Text>
                <Text style={[styles.dropLidTitle, { color: theme.colors.ink }]}>keepsakes</Text>
              </Animated.View>
            </View>

            <Pressable
              accessibilityLabel="Tuck this memory in without dragging"
              onPress={() => {
                dropIntoBox();
              }}
              style={styles.dropFallback}
            >
              <Text style={[styles.dropFallbackText, { color: theme.colors.rose }]}>
                or tap here to tuck it in
              </Text>
            </Pressable>
          </View>

          {saved ? (
            <Animated.View entering={FadeIn} style={styles.savedOverlay} pointerEvents="none">
              <View style={[styles.savedPill, { backgroundColor: theme.colors.surface }]}>
                <Check color={theme.colors.sage} size={16} strokeWidth={3} />
                <Text style={[styles.savedText, { color: theme.colors.ink }]}>tucked away forever</Text>
              </View>
            </Animated.View>
          ) : null}

          <LocationStampPicker
            autoDetect={!location}
            onClose={() => setLocationPickerOpen(false)}
            onSave={(next) => {
              setLocation(next);
            }}
            value={location}
            visible={locationPickerOpen}
          />
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  cameraRoot: {
    flex: 1,
  },
  topShade: {
    height: 170,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  bottomShade: {
    bottom: 0,
    height: 230,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  cameraTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  cameraTopRight: {
    flexDirection: 'row',
    gap: 8,
  },
  cameraCenter: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  permissionCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(28,25,23,0.78)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 26,
  },
  permissionEmoji: {
    fontSize: 38,
  },
  permissionTitle: {
    color: '#FFF7EA',
    fontFamily: fonts.serif,
    fontSize: 22,
    marginTop: 10,
    textAlign: 'center',
  },
  permissionText: {
    color: 'rgba(255,247,234,0.72)',
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#E11D48',
    borderRadius: 999,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontFamily: fonts.sansBold,
    fontSize: 13.5,
  },
  cameraError: {
    backgroundColor: 'rgba(28,25,23,0.85)',
    borderColor: 'rgba(251,146,60,0.5)',
    borderRadius: radii.sm,
    borderWidth: 1,
    bottom: 210,
    left: 28,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    right: 28,
  },
  cameraErrorText: {
    color: '#FDBA74',
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    textAlign: 'center',
  },
  cameraBottom: {
    alignItems: 'center',
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    position: 'absolute',
    width: '100%',
  },
  cameraBottomSide: {
    alignItems: 'center',
    gap: 5,
    width: 64,
  },
  rollButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(28,25,23,0.5)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  rollLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  shutterOuter: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 999,
    borderWidth: 3,
    height: 78,
    justifyContent: 'center',
    width: 78,
  },
  shutterInner: {
    alignItems: 'center',
    backgroundColor: '#FFF7EA',
    borderRadius: 999,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  arrangeRoot: {
    flex: 1,
  },
  arrangeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
  },
  arrangeHeaderCopy: {
    flex: 1,
  },
  arrangeKicker: {
    fontFamily: fonts.handBold,
    fontSize: 17,
    lineHeight: 18,
  },
  arrangeTitle: {
    fontFamily: fonts.serif,
    fontSize: 21,
    letterSpacing: -0.5,
    marginTop: -2,
  },
  arrangeScroll: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  hint: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  titleWrap: {
    marginBottom: 6,
    marginTop: 2,
    width: '100%',
  },
  titleInput: {
    borderBottomWidth: 1.5,
    fontFamily: fonts.handBold,
    fontSize: 23,
    paddingBottom: 3,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  titleCount: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 8,
    marginTop: 3,
    textAlign: 'right',
  },
  cardStage: {
    alignItems: 'center',
    marginTop: 2,
    zIndex: 4,
  },
  controls: {
    marginTop: 14,
    width: '100%',
  },
  locationPill: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11.5,
    maxWidth: 210,
  },
  locationEdit: {
    fontFamily: fonts.sansBold,
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  moodLabel: {
    fontFamily: fonts.handBold,
    fontSize: 16,
    marginBottom: 6,
    marginTop: 14,
    textAlign: 'center',
  },
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  moodChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  moodEmoji: {
    fontSize: 11,
  },
  moodText: {
    fontFamily: fonts.sansBold,
    fontSize: 9.5,
    letterSpacing: 0.2,
  },
  storyHintRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 2,
  },
  storyHint: {
    fontFamily: fonts.hand,
    fontSize: 15,
  },
  storyCount: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 8.5,
  },
  dropZone: {
    alignItems: 'center',
    paddingTop: 4,
  },
  dropHintWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  dropHint: {
    fontFamily: fonts.hand,
    fontSize: 15,
  },
  dropBoxWrap: {
    alignItems: 'center',
    height: 106,
    justifyContent: 'flex-end',
    width: 230,
  },
  dropShadow: {
    borderRadius: 999,
    bottom: 2,
    height: 12,
    opacity: 0.35,
    position: 'absolute',
    width: 170,
  },
  dropBox: {
    alignItems: 'center',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1.5,
    bottom: 8,
    height: 68,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    paddingBottom: 6,
    position: 'absolute',
    width: 190,
  },
  dropInside: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    height: 12,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dropInsideGlow: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 5,
    marginTop: 2,
    width: 100,
  },
  dropRibbon: {
    bottom: 0,
    opacity: 0.9,
    position: 'absolute',
    top: 0,
    width: 14,
  },
  dropLabel: {
    fontFamily: fonts.handBold,
    fontSize: 14,
  },
  dropLid: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1.5,
    bottom: 62,
    height: 34,
    overflow: 'hidden',
    position: 'absolute',
    width: 202,
    zIndex: 3,
    ...shadows.soft,
  },
  dropLidGradient: {
    borderRadius: 16,
  },
  dropLidRibbon: {
    bottom: 0,
    left: '45%',
    opacity: 0.9,
    position: 'absolute',
    top: 0,
    width: 14,
  },
  dropLidText: {
    fontFamily: fonts.hand,
    fontSize: 9,
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 2,
  },
  dropLidTitle: {
    fontFamily: fonts.serif,
    fontSize: 13,
    left: 0,
    letterSpacing: -0.4,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 12,
  },
  dropFallback: {
    marginTop: 2,
    paddingVertical: 4,
  },
  dropFallbackText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  savedOverlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  savedPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 11,
    ...shadows.card,
  },
  savedText: {
    fontFamily: fonts.sansBold,
    fontSize: 12.5,
  },
});
