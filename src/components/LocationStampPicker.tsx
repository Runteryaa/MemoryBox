import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, LocateFixed, MapPin, Sparkles, X } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
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

import { PressableScale } from '@/components/ui/PressableScale';
import { FALLBACK_PLACE_NAME } from '@/constants';
import { formatCoordinatesShort, detectCurrentPlace, locationErrorMessage } from '@/services/locationService';
import { haptics } from '@/lib/haptics';
import { formatStampDate } from '@/lib/date';
import { contrastInk, fonts, radii, shadows, useTheme } from '@/theme';
import type { MemoryLocation } from '@/types';

interface LocationStampPickerProps {
  visible: boolean;
  value: MemoryLocation | null;
  onSave: (location: MemoryLocation | null) => void;
  onClose: () => void;
  autoDetect?: boolean;
  /** Render as an absolute overlay instead of a nested Modal. */
  embedded?: boolean;
}

export function LocationStampPicker({
  visible,
  value,
  onSave,
  onClose,
  autoDetect = false,
  embedded = false,
}: LocationStampPickerProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [placeName, setPlaceName] = useState(value?.placeName ?? '');
  const [city, setCity] = useState(value?.city ?? '');
  const [country, setCountry] = useState(value?.country ?? '');
  const [coords, setCoords] = useState<{ latitude: number | null; longitude: number | null }>({
    latitude: value?.latitude ?? null,
    longitude: value?.longitude ?? null,
  });
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stamped, setStamped] = useState(false);

  const stampScale = useSharedValue(1);
  const stampRotate = useSharedValue(-1.5);
  const detectSpin = useSharedValue(0);
  const autoTried = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  // The little compass keeps turning while the GPS fix is in flight.
  useEffect(() => {
    if (detecting && !reducedMotion) {
      detectSpin.value = 0;
      detectSpin.value = withRepeat(
        withTiming(1, { duration: 1300, easing: Easing.linear }),
        -1,
        false
      );
      return;
    }
    detectSpin.value = withTiming(0, { duration: 260 });
  }, [detectSpin, detecting, reducedMotion]);

  const reset = useCallback(() => {
    setPlaceName(value?.placeName ?? '');
    setCity(value?.city ?? '');
    setCountry(value?.country ?? '');
    setCoords({
      latitude: value?.latitude ?? null,
      longitude: value?.longitude ?? null,
    });
    setError(null);
    setStamped(false);
    autoTried.current = false;
  }, [value]);

  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const runDetect = useCallback(async () => {
    if (detecting) return;
    setDetecting(true);
    setError(null);
    try {
      const location = await detectCurrentPlace();
      setPlaceName(location.placeName);
      setCity(location.city ?? '');
      setCountry(location.country ?? '');
      setCoords({ latitude: location.latitude, longitude: location.longitude });
      setStamped(true);
      if (!reducedMotion) {
        stampScale.value = withSequence(
          withTiming(1.16, { duration: 130 }),
          withSpring(1, { damping: 9, stiffness: 220 })
        );
        stampRotate.value = withSequence(
          withTiming(-4, { duration: 120 }),
          withSpring(-1.5, { damping: 8 })
        );
      }
      haptics.success();
    } catch (caught) {
      setError(locationErrorMessage(caught));
      haptics.warning();
    } finally {
      setDetecting(false);
    }
  }, [detecting, reducedMotion, stampRotate, stampScale]);

  useEffect(() => {
    if (visible && autoDetect && !autoTried.current) {
      autoTried.current = true;
      const timer = setTimeout(() => {
        void runDetect();
      }, 420);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoDetect, runDetect, visible]);

  const stampStyle = useAnimatedStyle(() => ({
    transform: [{ scale: stampScale.value }, { rotate: `${stampRotate.value}deg` }],
  }));

  // The sheet follows the finger when dragged by its grabber, then springs back
  // or leaves, exactly like the memory sheet.
  const pull = useSharedValue(0);
  const sheetDrag = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((event) => {
      pull.value = Math.max(0, event.translationY * 0.9);
    })
    .onEnd((event) => {
      if (pull.value > 110 || event.velocityY > 950) {
        pull.value = withTiming(480, { duration: 190, easing: Easing.in(Easing.quad) }, (finished) => {
          if (!finished) return;
          runOnJS(onClose)();
          pull.value = 0;
        });
        return;
      }
      pull.value = withSpring(0, { damping: 16, stiffness: 210 });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }));

  const backdropDimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [0, 300], [1, 0.4], 'clamp'),
  }));

  const detectIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${detectSpin.value * 360}deg` }],
  }));

  // Press the postmark down, then let the sheet leave like a stamped letter.
  const slamAndClose = () => {
    stampScale.value = withSequence(
      withTiming(1.2, { duration: 90 }),
      withSpring(1, { damping: 10, stiffness: 260 })
    );
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(onClose, 150);
  };

  const handleSave = () => {
    const trimmedPlace = placeName.trim();
    // A city or country on its own still counts as a place worth stamping.
    const hasAnything =
      trimmedPlace.length > 0 ||
      city.trim().length > 0 ||
      country.trim().length > 0 ||
      coords.latitude != null;
    if (!hasAnything) {
      onSave(null);
      haptics.tap();
      slamAndClose();
      return;
    }
    onSave({
      latitude: coords.latitude,
      longitude: coords.longitude,
      placeName: trimmedPlace || city.trim() || FALLBACK_PLACE_NAME,
      city: city.trim() || null,
      country: country.trim() || null,
    });
    haptics.success();
    slamAndClose();
  };

  const previewLocation: MemoryLocation = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    placeName: placeName.trim() || city.trim() || 'Somewhere lovely',
    city: city.trim() || null,
    country: country.trim() || null,
  };

  const canStamp =
    placeName.trim().length > 0 ||
    city.trim().length > 0 ||
    country.trim().length > 0 ||
    coords.latitude != null;

  const content = (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(160)}
      style={[styles.backdrop, embedded && styles.embedded, { backgroundColor: theme.colors.overlay }]}
    >
      <Pressable accessibilityLabel="Close location picker" onPress={onClose} style={StyleSheet.absoluteFill} />

      <Animated.View style={[StyleSheet.absoluteFill, backdropDimStyle]} pointerEvents="none" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
        style={styles.keyboardWrap}
      >
        <GestureDetector gesture={sheetDrag}>
          <Animated.View
            entering={SlideInDown.springify().damping(18).stiffness(160)}
            exiting={SlideOutDown.duration(200)}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.shadow,
              },
              sheetStyle,
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: theme.colors.borderStrong }]} />

            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={[styles.kicker, { color: theme.colors.rose }]}>postmark it</Text>
                <Text style={[styles.title, { color: theme.colors.ink }]}>Where was this?</Text>
              </View>
              <PressableScale
                accessibilityHint="Leaves the place as it was"
                accessibilityLabel="Close location picker"
                haptic="none"
                hitSlop={5}
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: theme.colors.surfaceRaised, borderColor: theme.colors.border }]}
              >
                <X color={theme.colors.muted} size={17} strokeWidth={2.4} />
              </PressableScale>
            </View>

            <View style={styles.body}>
              <Animated.View style={[styles.stamp, stampStyle]}>
                <View
                  style={[
                    styles.stampInner,
                    {
                      borderColor: theme.colors.stamp,
                      backgroundColor: theme.colors.paper,
                    },
                  ]}
                >
                  <View style={styles.stampTopRow}>
                    <MapPin color={theme.colors.stamp} size={11} strokeWidth={2.6} />
                    <Text style={[styles.stampPostage, { color: theme.colors.stamp }]}>
                      MEMORY POST · {formatStampDate()}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={[styles.stampPlace, { color: theme.colors.ink }]}>
                    {previewLocation.placeName?.trim() ||
                      previewLocation.city ||
                      'a place on the map'}
                  </Text>
                  <Text numberOfLines={1} style={[styles.stampCity, { color: theme.colors.stamp }]}>
                    {[previewLocation.city, previewLocation.country].filter(Boolean).join(' · ').toUpperCase() ||
                      'SOMEWHERE ON THIS EARTH'}
                  </Text>
                  <Text style={[styles.stampCoords, { color: theme.colors.faint }]}>
                    {coords.latitude != null
                      ? formatCoordinatesShort(previewLocation)
                      : 'NO COORDINATES — JUST A FEELING'}
                  </Text>
                </View>
                {stamped ? (
                  <Animated.View entering={FadeIn.delay(120)} style={styles.stampedBadge}>
                    <Sparkles color={theme.colors.gold} size={14} strokeWidth={2.2} />
                  </Animated.View>
                ) : null}
              </Animated.View>

              <PressableScale
                accessibilityHint="Fills the postmark from where you are now"
                accessibilityLabel="Detect my current location"
                disabled={detecting}
                haptic="soft"
                onPress={() => {
                  void runDetect();
                }}
                style={[
                  styles.detectButton,
                  {
                    backgroundColor: theme.colors.sageSoft,
                    borderColor: theme.colors.sage,
                  },
                ]}
              >
                <LinearGradient
                  colors={[theme.colors.sage, theme.colors.sage]}
                  style={styles.detectIcon}
                >
                  <Animated.View style={detectIconStyle}>
                    <LocateFixed color={contrastInk(theme.colors.sage)} size={15} strokeWidth={2.6} />
                  </Animated.View>
                </LinearGradient>
                <View style={styles.detectCopy}>
                  <Text style={[styles.detectTitle, { color: theme.colors.sage }]}>
                    {detecting ? 'Reading the stars…' : 'Use my current spot'}
                  </Text>
                  <Text style={[styles.detectHint, { color: theme.colors.muted }]}>
                    {detecting ? 'Finding you on the map' : 'GPS + a friendly place name'}
                  </Text>
                </View>
              </PressableScale>

              {error ? (
                <Text
                  accessibilityLiveRegion="assertive"
                  style={[styles.error, { color: theme.colors.danger }]}
                >
                  {error}
                </Text>
              ) : null}

              <View style={styles.fields}>
                <Field
                  label="Place name"
                  onChangeText={setPlaceName}
                  placeholder="Grandma's kitchen"
                  value={placeName}
                />
                <View style={styles.fieldRow}>
                  <View style={styles.fieldHalf}>
                    <Field
                      label="City"
                      onChangeText={setCity}
                      placeholder="Lisbon"
                      value={city}
                    />
                  </View>
                  <View style={styles.fieldHalf}>
                    <Field
                      label="Country"
                      onChangeText={setCountry}
                      placeholder="Portugal"
                      value={country}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.footer}>
              <PressableScale
                accessibilityLabel={
                  canStamp ? 'Save this place' : 'Type a place before stamping'
                }
                disabled={!canStamp}
                haptic="none"
                onPress={handleSave}
                style={[styles.saveButton, { backgroundColor: theme.colors.rose }]}
              >
                <Check color={contrastInk(theme.colors.rose)} size={16} strokeWidth={3} />
                <Text style={[styles.saveText, { color: contrastInk(theme.colors.rose) }]}>Stamp it</Text>
              </PressableScale>

              {value || canStamp ? (
                <PressableScale
                  accessibilityLabel="Remove location"
                  haptic="none"
                  onPress={() => {
                    haptics.tap();
                    onSave(null);
                    onClose();
                  }}
                  style={[styles.clearButton, { borderColor: theme.colors.borderStrong }]}
                >
                  <Text style={[styles.clearText, { color: theme.colors.muted }]}>No place</Text>
                </PressableScale>
              ) : null}
            </View>
          </Animated.View>
        </GestureDetector>
        </KeyboardAvoidingView>
      </Animated.View>
  );

  if (embedded) {
    return visible ? content : null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      {content}
    </Modal>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.colors.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        maxFontSizeMultiplier={1.3}
        maxLength={80}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.faint}
        returnKeyType="done"
        selectionColor={theme.colors.rose}
        style={[
          styles.fieldInput,
          {
            color: theme.colors.ink,
            backgroundColor: theme.colors.surfaceRaised,
            borderColor: theme.colors.border,
          },
        ]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  embedded: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 40,
  },
  keyboardWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    paddingBottom: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 24,
  },
  grabber: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    marginBottom: 12,
    width: 42,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    fontSize: 24,
    letterSpacing: -0.6,
    marginTop: -2,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  body: {
    marginTop: 12,
  },
  stamp: {
    alignSelf: 'center',
  },
  stampInner: {
    borderRadius: 4,
    borderStyle: 'dashed',
    borderWidth: 1.4,
    minWidth: 230,
    paddingHorizontal: 14,
    paddingVertical: 10,
    transform: [{ rotate: '-1.5deg' }],
  },
  stampTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  stampPostage: {
    fontFamily: fonts.sansBold,
    fontSize: 7.5,
    letterSpacing: 1.1,
  },
  stampPlace: {
    fontFamily: fonts.handBold,
    fontSize: 24,
    lineHeight: 26,
    marginTop: 2,
  },
  stampCity: {
    fontFamily: fonts.sansBold,
    fontSize: 8,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  stampCoords: {
    fontFamily: fonts.sans,
    fontSize: 8,
    letterSpacing: 0.4,
    marginTop: 4,
  },
  stampedBadge: {
    position: 'absolute',
    right: -10,
    top: -10,
  },
  detectButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detectIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  detectCopy: {
    flex: 1,
  },
  detectTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
  },
  detectHint: {
    fontFamily: fonts.sans,
    fontSize: 10.5,
    marginTop: 1,
  },
  error: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    marginTop: 8,
  },
  fields: {
    gap: 10,
    marginTop: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldHalf: {
    flex: 1,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  fieldInput: {
    borderRadius: radii.sm,
    borderWidth: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    paddingVertical: 13,
    ...shadows.soft,
  },
  saveText: {
    color: '#FFFFFF',
    fontFamily: fonts.sansBold,
    fontSize: 14,
  },
  clearButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  clearText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
  },
});
