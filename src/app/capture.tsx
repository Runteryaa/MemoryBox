import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
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
  ZoomIn,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
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
  /** Pixel size, known the moment the photo arrives, so the card never jumps. */
  width?: number | null;
  height?: number | null;
}

export default function CaptureScreen() {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
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
  const stageLayout = useRef({ top: 0, height: 0 });
  const boxLayout = useRef({ top: 0 });
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [stageHeight, setStageHeight] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const dragY = useSharedValue(0);
  const dragScale = useSharedValue(1);
  const dragRotate = useSharedValue(0);
  const dragOpacity = useSharedValue(1);
  const lidOpen = useSharedValue(0);
  const armed = useSharedValue(0);
  const boxBounce = useSharedValue(1);
  const shutter = useSharedValue(0);
  const shutterBreath = useSharedValue(0);
  const [burstKey, setBurstKey] = useState(0);

  // While the keyboard is up the stage shrinks; keep the card the same size so
  // writing the story never makes the polaroid jump or resize under the finger.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // The card must fit the fixed (non-scrolling) stage so dragging never fights a scroll view.
  // Card height is roughly width * 1.02 + 90 (photo + paper margins + caption).
  const cardWidth = Math.max(
    168,
    Math.min(
      300,
      width - 64,
      !keyboardVisible && stageHeight > 0 ? (stageHeight - 118) / 1.02 : 300
    )
  );
  // A tall portrait frame could still outgrow the stage, so the card is told
  // the ceiling it has to respect and shrinks its photo frame to fit.
  const cardMaxHeight = !keyboardVisible && stageHeight > 0 ? stageHeight - 58 : undefined;

  // Abandoned drafts should not leave orphaned photos in the document folder,
  // and no stray timer should fire into a screen that has already left.
  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = [];
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
    async (
      sourceUri: string,
      exif: Record<string, unknown> | null,
      fromCamera: boolean,
      size?: { width?: number | null; height?: number | null }
    ) => {
      const storedUri = await persistMemoryImage(sourceUri);
      const previousDraft = draftUriRef.current;
      draftUriRef.current = storedUri;
      if (previousDraft && previousDraft !== storedUri) {
        void deleteMemoryImage(previousDraft);
      }
      setPhoto({
        uri: storedUri,
        dateCreated: extractExifDate(exif) ?? new Date().toISOString(),
        width: size?.width ?? null,
        height: size?.height ?? null,
      });
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
        timersRef.current.push(setTimeout(() => setDeveloping(false), 1750));
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
    shutter.value = withSequence(
      withTiming(0.92, { duration: 55 }),
      withTiming(0, { duration: 240, easing: Easing.out(Easing.quad) })
    );
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.86,
        exif: true,
      });
      if (!picture?.uri) throw new Error('No photo returned');
      await adoptPhoto(
        picture.uri,
        (picture.exif as Record<string, unknown> | null) ?? null,
        true,
        { width: picture.width, height: picture.height }
      );
      haptics.success();
    } catch {
      setCameraError('The camera stumbled. Try again, or pick a photo from your library.');
      haptics.error();
    } finally {
      setTaking(false);
    }
  }, [adoptPhoto, shutter, taking]);

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
      await adoptPhoto(
        asset.uri,
        (asset.exif as Record<string, unknown> | null) ?? null,
        false,
        { width: asset.width, height: asset.height }
      );
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
      imageWidth: photo.width ?? null,
      imageHeight: photo.height ?? null,
    };

    timersRef.current.push(
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
        timersRef.current.push(
          setTimeout(() => {
            addMemory(input);
          }, 220)
        );
      }, 260)
    );
  }, [addMemory, description, location, mood, photo, title]);

  const dropIntoBox = useCallback(() => {
    if (savedRef.current) return;
    const cardCenter = stageLayout.current.top + stageLayout.current.height / 2;
    const boxCenter = boxLayout.current.top + 54;
    const distance = Math.max(200, boxCenter - cardCenter);

    dragY.value = withTiming(distance, { duration: 440, easing: Easing.in(Easing.cubic) });
    dragScale.value = withTiming(0.16, { duration: 440, easing: Easing.in(Easing.cubic) });
    dragRotate.value = withTiming(8, { duration: 440 });
    dragOpacity.value = withTiming(0, {
      duration: 440,
      easing: Easing.in(Easing.quad),
    });
    lidOpen.value = withSequence(
      withTiming(1, { duration: 180 }),
      withTiming(1, { duration: 250 }),
      withTiming(0, { duration: 190 })
    );
    timersRef.current.push(setTimeout(finishCapture, 410));
    // The keepsake lands: a sparkle burst plus a soft bounce of the box itself.
    timersRef.current.push(
      setTimeout(() => {
        setBurstKey((key) => key + 1);
        haptics.soft();
        boxBounce.value = withSequence(
          withTiming(1.05, { duration: 120 }),
          withSpring(1, { damping: 9, stiffness: 200 })
        );
      }, 320)
    );
  }, [boxBounce, dragOpacity, dragRotate, dragScale, dragY, finishCapture, lidOpen]);

  const dragGesture = Gesture.Pan()
    .enabled(!cardFlipped && !saved)
    .activeOffsetY([-14, 14])
    .failOffsetX([-40, 40])
    .onBegin(() => {
      armed.value = 0;
    })
    .onUpdate((event) => {
      dragY.value = Math.max(-24, event.translationY);
      dragScale.value = interpolate(event.translationY, [-24, 260], [1.01, 0.74], 'clamp');
      dragRotate.value = interpolate(event.translationY, [0, 240], [0, 6], 'clamp');
      dragOpacity.value = interpolate(event.translationY, [180, 320], [1, 0.9], 'clamp');
      lidOpen.value = interpolate(event.translationY, [60, 160], [0, 1], 'clamp');
      // One soft tick the moment the card is far enough to be let go, so the
      // drop never feels like a guess.
      if (event.translationY > 96 && armed.value === 0) {
        armed.value = 1;
        runOnJS(haptics.selection)();
      } else if (event.translationY <= 96 && armed.value === 1) {
        armed.value = 0;
      }
    })
    .onEnd((event) => {
      armed.value = 0;
      if (event.translationY > 100 || event.velocityY > 700) {
        runOnJS(dropIntoBox)();
        return;
      }
      dragY.value = withSpring(0, { damping: 17, stiffness: 210 });
      dragScale.value = withSpring(1, { damping: 17, stiffness: 210 });
      dragRotate.value = withSpring(0, { damping: 17, stiffness: 210 });
      dragOpacity.value = withTiming(1, { duration: 140 });
      lidOpen.value = withTiming(0, { duration: 180 });
    });

  const cardDragStyle = useAnimatedStyle(() => ({
    opacity: dragOpacity.value,
    transform: [
      { translateY: dragY.value },
      { scale: dragScale.value },
      { rotate: `${dragRotate.value}deg` },
    ],
  }));

  const lidStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateY: lidOpen.value * -7 },
      { rotateX: `${-72 * lidOpen.value}deg` },
    ],
  }));

  const boxGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lidOpen.value, [0, 1], [0, 0.8]),
  }));

  const dropHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lidOpen.value, [0, 1], [0.55, 1], 'clamp'),
    transform: [{ translateY: interpolate(lidOpen.value, [0, 1], [0, 3], 'clamp') }],
  }));

  const boxBounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: boxBounce.value }],
  }));

  const shutterStyle = useAnimatedStyle(() => ({
    opacity: shutter.value,
  }));

  // The shutter ring breathes gently, inviting the tap.
  useEffect(() => {
    if (step !== 'camera' || reducedMotion) {
      shutterBreath.value = 0;
      return;
    }
    shutterBreath.value = withRepeat(
      withTiming(1, { duration: 1900, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    return () => {
      cancelAnimation(shutterBreath);
    };
  }, [reducedMotion, shutterBreath, step]);

  const shutterRingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shutterBreath.value, [0, 1], [0.55, 0]),
    transform: [{ scale: interpolate(shutterBreath.value, [0, 1], [1, 1.28]) }],
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

          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.shutterFlash, shutterStyle]}
          />

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

          <Animated.View
            entering={FadeInDown.duration(420)}
            style={[styles.cameraTop, { paddingTop: insets.top + 6 }]}
          >
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
                  setFacing((current) => (current === 'back' ? 'front' : 'back'));
                }}
              />
            </View>
          </Animated.View>

          <View style={styles.cameraCenter}>
            {!permission?.granted ? (
              <View style={styles.permissionCard}>
                <Text style={styles.permissionEmoji}>📷</Text>
                <Text style={styles.permissionTitle}>
                  {permission?.canAskAgain === false ? 'The camera is resting' : "Let's open the camera"}
                </Text>
                <Text style={styles.permissionText}>
                  {permission?.canAskAgain === false
                    ? 'Camera access is switched off for Memory Box. You can turn it back on in Settings — or pick a photo you already love.'
                    : 'Memory Box needs a peek through your lens to capture the moment. You can also pick a photo you already love.'}
                </Text>
                <PressableScale
                  accessibilityLabel={
                    permission?.canAskAgain === false
                      ? 'Open Settings to allow camera access'
                      : 'Allow camera access'
                  }
                  haptic="medium"
                  onPress={() => {
                    // Once Android stops asking, re-requesting does nothing at
                    // all, so send the person somewhere that can actually help.
                    if (permission?.canAskAgain === false) {
                      void Linking.openSettings();
                      return;
                    }
                    void requestPermission();
                  }}
                  style={styles.permissionButton}
                >
                  <Text style={styles.permissionButtonText}>
                    {permission?.canAskAgain === false ? 'Open Settings' : 'Allow camera'}
                  </Text>
                </PressableScale>
              </View>
            ) : null}
          </View>

          {cameraError ? (
            <Animated.View entering={FadeIn} style={styles.cameraError}>
              <Text style={styles.cameraErrorText}>{cameraError}</Text>
            </Animated.View>
          ) : null}

          <Animated.View
            entering={FadeInDown.duration(460).delay(80)}
            style={[styles.cameraBottom, { paddingBottom: insets.bottom + 16 }]}
          >
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
              <Animated.View
                pointerEvents="none"
                style={[styles.shutterRing, { borderColor: 'rgba(255,255,255,0.5)' }, shutterRingStyle]}
              />
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
                accessibilityLabel="Cancel and close the camera"
                haptic="soft"
                onPress={close}
                style={styles.rollButton}
              >
                <X color="#FFFFFF" size={20} strokeWidth={2.2} />
              </PressableScale>
              <Text style={styles.rollLabel}>cancel</Text>
            </View>
          </Animated.View>
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(240)} style={styles.arrangeRoot}>
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

          <View
            onLayout={(event) => {
              const { y, height: heightValue } = event.nativeEvent.layout;
              stageLayout.current = { top: y, height: heightValue };
              // Keyboard-driven height changes must not resize the card.
              if (keyboardVisible) return;
              setStageHeight((current) => (current === heightValue ? current : heightValue));
            }}
            style={[styles.cardStage, keyboardVisible && styles.cardStageTyping]}
          >
            <Animated.View entering={FadeInDown.duration(340)}>
              <Animated.Text
                entering={FadeIn.duration(200)}
                key={cardFlipped ? 'back' : 'front'}
                style={[styles.hint, { color: theme.colors.muted }]}
              >
                {photo ? formatMediumDate(photo.dateCreated) : ''}
                {cardFlipped ? ' · writing on the back' : ' · tap the card to flip it'}
              </Animated.Text>
            </Animated.View>

            {photo ? (
              <Animated.View
                entering={FadeInDown.duration(420).delay(60)}
                style={styles.cardHolder}
              >
                <GestureDetector gesture={dragGesture}>
                  <Animated.View style={cardDragStyle}>
                    <FlippablePolaroidCard
                      autoFocusStory
                      developing={developing}
                      editable
                      flipped={cardFlipped}
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
                        imageWidth: photo.width ?? null,
                        imageHeight: photo.height ?? null,
                      }}
                      onDescriptionChange={setDescription}
                      onEditLocation={() => {
                        locationTouched.current = true;
                        setLocationPickerOpen(true);
                      }}
                      onFlipChange={(flipped) => {
                        setCardFlipped(flipped);
                        if (!flipped) Keyboard.dismiss();
                      }}
                      maxHeight={cardMaxHeight}
                      width={cardWidth}
                    />
                  </Animated.View>
                </GestureDetector>
              </Animated.View>
            ) : null}
          </View>

          <Animated.View
            entering={FadeInDown.duration(440).delay(110)}
            style={[styles.composer, keyboardVisible && styles.composerHidden]}
          >
            <View style={styles.titleWrap}>
              <TextInput
                accessibilityLabel="Name this moment"
                maxFontSizeMultiplier={1.3}
                maxLength={MAX_TITLE_LENGTH}
                onChangeText={setTitle}
                placeholder="Name this moment…"
                placeholderTextColor={theme.colors.faint}
                returnKeyType="done"
                selectionColor={theme.colors.rose}
                style={[
                  styles.titleInput,
                  { color: theme.colors.ink, borderColor: theme.colors.borderStrong },
                ]}
                value={title}
              />
              <Text style={[styles.titleCount, { color: theme.colors.faint }]}>
                {title.length}/{MAX_TITLE_LENGTH}
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={styles.composerRow}
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
            >
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
                  size={13}
                  strokeWidth={2.5}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.locationText,
                    { color: location ? theme.colors.sage : theme.colors.muted },
                  ]}
                >
                  {location ? location.placeName : 'Add a place'}
                </Text>
              </PressableScale>

              <View style={[styles.composerDivider, { backgroundColor: theme.colors.borderStrong }]} />

              <Text style={[styles.moodLabel, { color: theme.colors.faint }]}>felt</Text>
              {MOODS.map((option) => (
                <MoodChip
                  active={mood === option.id}
                  color={option.color}
                  emoji={option.emoji}
                  key={option.id}
                  label={option.label}
                  onPress={() => setMood(option.id)}
                  soft={option.soft}
                />
              ))}
            </ScrollView>

            <PressableScale
              accessibilityLabel="Flip the card over and write the story"
              disabled={cardFlipped}
              haptic="tap"
              onPress={() => setCardFlipped(true)}
              scaleTo={0.98}
              style={styles.storyHintRow}
            >
              <Text numberOfLines={1} style={[styles.storyHint, { color: theme.colors.muted }]}>
                {cardFlipped
                  ? 'tap “see photo” when the story is done'
                  : 'tap the card to write the story on its back'}
              </Text>
              <Text style={[styles.storyCount, { color: theme.colors.faint }]}>
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </Text>
            </PressableScale>
          </Animated.View>

          <View
            onLayout={(event) => {
              boxLayout.current.top = event.nativeEvent.layout.y;
            }}
            style={[
              styles.dropZone,
              { paddingBottom: Math.max(insets.bottom, 14) },
              keyboardVisible && styles.dropZoneHidden,
            ]}
          >
            <Animated.View style={[styles.dropHintWrap, dropHintStyle]}>
              <ArrowDown color={theme.colors.faint} size={13} strokeWidth={2.4} />
              <Text style={[styles.dropHint, { color: theme.colors.muted }]}>
                {cardFlipped ? 'flip back, then drag it down' : 'drag the photo down to tuck it in'}
              </Text>
            </Animated.View>

            <Animated.View style={[styles.dropBoxWrap, boxBounceStyle]}>
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
            </Animated.View>

            <PressableScale
              accessibilityLabel="Tuck this memory in without dragging"
              disabled={saved}
              haptic="none"
              onPress={() => {
                dropIntoBox();
              }}
              scaleTo={0.94}
              style={[styles.dropFallback, saved && styles.dropFallbackSpent]}
            >
              <Text style={[styles.dropFallbackText, { color: theme.colors.rose }]}>
                or tap here to tuck it in
              </Text>
            </PressableScale>
          </View>

          {saved ? (
            <Animated.View entering={FadeIn} style={styles.savedOverlay} pointerEvents="none">
              <Animated.View
                entering={FadeInDown.springify().damping(13).stiffness(190).delay(60)}
                style={[styles.savedPill, { backgroundColor: theme.colors.surface }]}
              >
                <Animated.View entering={ZoomIn.delay(180).springify().damping(11)}>
                  <Check color={theme.colors.sage} size={16} strokeWidth={3} />
                </Animated.View>
                <Text style={[styles.savedText, { color: theme.colors.ink }]}>tucked away forever</Text>
              </Animated.View>
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
        </Animated.View>
      )}
    </View>
  );
}

/** Mood chips pop into place when chosen, like pressing a wax seal. */
function MoodChip({
  label,
  emoji,
  color,
  soft,
  active,
  onPress,
}: {
  label: string;
  emoji: string;
  color: string;
  soft: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!active) return;
    scale.value = withSequence(
      withTiming(1.12, { duration: 90 }),
      withSpring(1, { damping: 10, stiffness: 260 })
    );
  }, [active, scale]);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <PressableScale
      accessibilityLabel={`${label} mood`}
      haptic="selection"
      onPress={onPress}
      selected={active}
      style={[
        styles.moodChip,
        {
          backgroundColor: active ? soft : theme.colors.surface,
          borderColor: active ? color : theme.colors.border,
        },
      ]}
    >
      <Animated.Text style={[styles.moodEmoji, emojiStyle]}>{emoji}</Animated.Text>
      <Text
        style={[
          styles.moodText,
          { color: active ? color : theme.colors.muted },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
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
  shutterFlash: {
    backgroundColor: '#FFFFFF',
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
  shutterRing: {
    borderRadius: 999,
    borderWidth: 2,
    bottom: -4,
    left: -4,
    position: 'absolute',
    right: -4,
    top: -4,
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
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 4,
    zIndex: 4,
  },
  cardStageTyping: {
    justifyContent: 'flex-start',
  },
  cardHolder: {
    marginTop: 6,
  },
  composer: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  composerHidden: {
    display: 'none',
  },
  composerRow: {
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
    paddingVertical: 2,
  },
  composerDivider: {
    height: 18,
    marginHorizontal: 2,
    opacity: 0.5,
    width: 1,
  },
  locationPill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    maxWidth: 190,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    maxWidth: 150,
  },
  moodLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 8,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
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
  dropZoneHidden: {
    display: 'none',
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
    backfaceVisibility: 'hidden',
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
    zIndex: 2,
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
  dropFallbackSpent: {
    opacity: 0.4,
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
