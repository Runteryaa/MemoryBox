import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Check, Heart, MapPin, Pencil, Trash2, X } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
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
import { IconButton } from '@/components/ui/IconButton';
import { PressableScale } from '@/components/ui/PressableScale';
import { MAX_TITLE_LENGTH, MOODS } from '@/constants';
import { haptics } from '@/lib/haptics';
import { useMemoryStore } from '@/store/useMemoryStore';
import { contrastInk, fonts, radii, shadows, useTheme } from '@/theme';
import type { Memory, MoodTag } from '@/types';

interface MemoryInspectionModalProps {
  memory: Memory | null;
  visible: boolean;
  onClose: () => void;
}

export function MemoryInspectionModal({
  memory: memoryProp,
  visible,
  onClose,
}: MemoryInspectionModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const updateMemory = useMemoryStore((state) => state.updateMemory);
  const updateLocation = useMemoryStore((state) => state.updateLocation);
  const toggleFavorite = useMemoryStore((state) => state.toggleFavorite);
  const deleteMemory = useMemoryStore((state) => state.deleteMemory);

  // Always show the freshest copy so edits, favorites and places update live.
  const memory = useMemoryStore((state) =>
    memoryProp
      ? state.memories.find((item) => item.id === memoryProp.id) ?? memoryProp
      : null
  );

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mood, setMood] = useState<MoodTag>('happy');
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const heart = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heart.value }],
  }));

  // Dragging the top bar pulls the whole sheet down; past a threshold it lets go.
  const pull = useSharedValue(0);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: pull.value },
      { scale: interpolate(pull.value, [0, 280], [1, 0.94], 'clamp') },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [0, 280], [1, 0.35], 'clamp'),
  }));

  const popHeart = () => {
    heart.value = withSequence(
      withTiming(1.3, { duration: 110 }),
      withSpring(1, { damping: 9, stiffness: 240 })
    );
  };

  const cardWidth = Math.min(320, width - 64);
  const landscape = height < 640;

  useEffect(() => {
    if (!visible) return;
    setEditing(false);
    setTitle(memory?.shortTitle ?? '');
    setDescription(memory?.description ?? '');
    setMood(memory?.moodTag ?? 'happy');
    setLocationPickerOpen(false);
    setConfirmingDelete(false);
  }, [memory?.id, memory?.shortTitle, memory?.description, memory?.moodTag, visible]);

  const liveMemory = useMemo(() => {
    if (!memory) return null;
    return editing ? { ...memory, shortTitle: title, description, moodTag: mood } : memory;
  }, [description, editing, memory, mood, title]);

  const saveEdits = useCallback(() => {
    if (!memory) return;
    const nextTitle = title.trim() || 'A little moment';
    updateMemory(memory.id, {
      shortTitle: nextTitle,
      description,
      moodTag: mood,
    });
    setTitle(nextTitle);
    haptics.success();
    setEditing(false);
  }, [description, memory, mood, title, updateMemory]);

  const dismiss = useCallback(() => {
    // Typing a story and flicking the sheet away should keep the words, not
    // quietly throw them out with the sheet.
    if (editing) saveEdits();
    onClose();
  }, [editing, onClose, saveEdits]);

  // Dragging the top bar pulls the whole sheet down; past a threshold it lets go.
  const dragGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onUpdate((event) => {
      pull.value = Math.max(0, event.translationY * 0.9);
    })
    .onEnd((event) => {
      const flung = event.velocityY > 950;
      const dragged = pull.value > 120;
      if (flung || dragged) {
        // Let the sheet finish travelling off-screen before it actually closes,
        // otherwise it snaps back to centre for a frame on the way out.
        pull.value = withTiming(height, { duration: 200, easing: Easing.in(Easing.quad) }, (finished) => {
          if (!finished) return;
          runOnJS(dismiss)();
          pull.value = 0;
        });
        return;
      }
      pull.value = withSpring(0, { damping: 16, stiffness: 210 });
    });

  const confirmDelete = useCallback(() => {
    if (!memory) return;
    // A memory deserves a proper pause, in the same paper and ink as the rest.
    setConfirmingDelete(true);
  }, [memory]);

  const letGo = useCallback(() => {
    if (!memory) return;
    setConfirmingDelete(false);
    haptics.warning();
    onClose();
    void deleteMemory(memory.id);
  }, [deleteMemory, memory, onClose]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (confirmingDelete) {
          setConfirmingDelete(false);
        } else if (editing) {
          saveEdits();
        } else {
          onClose();
        }
      }}
      statusBarTranslucent
      transparent
      visible={visible && memory != null}
    >
      <Animated.View
        style={[styles.backdrop, { backgroundColor: theme.colors.overlay }, backdropStyle]}
      >
        <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill} />

        <Animated.View accessibilityViewIsModal style={[styles.keyboard, sheetStyle]}>
          <GestureDetector gesture={dragGesture}>
            <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
              <View style={styles.grabberWrap}>
                <View style={[styles.grabber, { backgroundColor: 'rgba(255,255,255,0.32)' }]} />
              </View>
              <View style={styles.topActions}>
                <IconButton
                  accessibilityLabel="Close memory"
                  backgroundColor={theme.isDark ? 'rgba(28,25,23,0.65)' : 'rgba(255,255,255,0.16)'}
                  borderColor="transparent"
                  color={theme.colors.white}
                  icon={X}
                  onPress={dismiss}
                />
                <View style={styles.topActionsGroup}>
                  <Animated.View style={heartStyle}>
                    <IconButton
                      accessibilityLabel={memory?.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
                      backgroundColor={theme.isDark ? 'rgba(28,25,23,0.65)' : 'rgba(255,255,255,0.16)'}
                      borderColor="transparent"
                      color={memory?.isFavorite ? theme.colors.rose : theme.colors.white}
                      icon={Heart}
                      onPress={() => {
                        if (!memory) return;
                        popHeart();
                        toggleFavorite(memory.id);
                      }}
                      selected={memory?.isFavorite}
                    />
                  </Animated.View>
                  <IconButton
                    accessibilityLabel={editing ? 'Save changes' : 'Edit this memory'}
                    backgroundColor={
                      editing
                        ? theme.colors.rose
                        : theme.isDark
                          ? 'rgba(28,25,23,0.65)'
                          : 'rgba(255,255,255,0.16)'
                    }
                    borderColor="transparent"
                    color={editing ? contrastInk(theme.colors.rose) : theme.colors.white}
                    icon={editing ? Check : Pencil}
                    onPress={() => {
                      if (editing) {
                        saveEdits();
                      } else {
                        setEditing(true);
                      }
                    }}
                  />
                  <IconButton
                    accessibilityLabel="Delete this memory"
                    backgroundColor={theme.isDark ? 'rgba(28,25,23,0.65)' : 'rgba(255,255,255,0.16)'}
                    borderColor="transparent"
                    color={theme.colors.white}
                    icon={Trash2}
                    onPress={confirmDelete}
                  />
                </View>
              </View>
            </View>
          </GestureDetector>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboard}
          >
            <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 24, paddingTop: landscape ? 4 : 10 },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {liveMemory ? (
              <Animated.View
                entering={FadeInDown.springify().damping(17).stiffness(130)}
                style={[styles.cardWrap, shadows.card]}
              >
                <FlippablePolaroidCard
                  editable={editing}
                  memory={liveMemory}
                  onDescriptionChange={setDescription}
                  onEditLocation={() => setLocationPickerOpen(true)}
                  showFavorite={false}
                  width={cardWidth}
                />
              </Animated.View>
            ) : null}

            {editing ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(160)}
                style={[
                  styles.editPanel,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <Text style={[styles.editLabel, { color: theme.colors.muted }]}>
                  Front caption · {title.length}/{MAX_TITLE_LENGTH}
                </Text>
                <TextInput
                  maxLength={MAX_TITLE_LENGTH}
                  onChangeText={setTitle}
                  placeholder="Give this moment a name"
                  placeholderTextColor={theme.colors.faint}
                  returnKeyType="done"
                  selectionColor={theme.colors.rose}
                  style={[
                    styles.titleInput,
                    {
                      color: theme.colors.ink,
                      backgroundColor: theme.colors.surfaceRaised,
                      borderColor: theme.colors.border,
                    },
                  ]}
                  value={title}
                />

                <Text style={[styles.editLabel, { color: theme.colors.muted, marginTop: 12 }]}>
                  How it felt
                </Text>
                <ScrollView
                  contentContainerStyle={styles.moodRow}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {MOODS.map((option) => {
                    const active = mood === option.id;
                    return (
                      <PressableScale
                        accessibilityLabel={`${option.label} mood`}
                        haptic="selection"
                        key={option.id}
                        onPress={() => {
                          setMood(option.id);
                        }}
                        selected={active}
                        style={[
                          styles.moodChip,
                          {
                            backgroundColor: active ? option.soft : theme.colors.surfaceRaised,
                            borderColor: active ? option.color : theme.colors.border,
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
                </ScrollView>

                <View style={styles.editRow}>
                  <View
                    style={[
                      styles.locationPill,
                      {
                        backgroundColor: memory?.location ? theme.colors.sageSoft : theme.colors.surfaceRaised,
                        borderColor: memory?.location ? theme.colors.sage : theme.colors.borderStrong,
                      },
                    ]}
                  >
                    <MapPin
                      color={memory?.location ? theme.colors.sage : theme.colors.muted}
                      size={13}
                      strokeWidth={2.5}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.locationText,
                        { color: memory?.location ? theme.colors.sage : theme.colors.muted },
                      ]}
                    >
                      {memory?.location?.placeName ?? 'Add a place'}
                    </Text>
                    <View style={styles.locationButtonWrap}>
                      <IconButton
                        accessibilityLabel="Change this memory's place"
                        backgroundColor="transparent"
                        borderColor="transparent"
                        color={memory?.location ? theme.colors.sage : theme.colors.muted}
                        icon={Pencil}
                        iconSize={12}
                        onPress={() => setLocationPickerOpen(true)}
                        size={26}
                      />
                    </View>
                  </View>
                </View>
                <Text style={[styles.editHint, { color: theme.colors.faint }]}>
                  Flip the card to write the story on the back.
                </Text>
              </Animated.View>
            ) : (
              <Text style={[styles.hint, { color: 'rgba(255,255,255,0.78)' }]}>
                tap the card to flip it over
              </Text>
            )}
          </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>

        <LocationStampPicker
          embedded
          onClose={() => setLocationPickerOpen(false)}
          onSave={(location) => {
            if (!memory) return;
            updateLocation(memory.id, location);
          }}
          value={memory?.location ?? null}
          visible={locationPickerOpen}
        />

        {confirmingDelete ? (
          <Animated.View
            accessibilityViewIsModal
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(120)}
            style={[StyleSheet.absoluteFill, styles.confirmOverlay]}
          >
            <Pressable
              accessibilityLabel="Keep this memory in the box"
              onPress={() => {
                setConfirmingDelete(false);
              }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View
              entering={FadeInDown.duration(220)}
              style={[
                styles.confirmCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  shadowColor: theme.colors.shadow,
                },
                shadows.card,
              ]}
            >
              <Text style={[styles.confirmKicker, { color: theme.colors.rose }]}>
                one last look
              </Text>
              <Text style={[styles.confirmTitle, { color: theme.colors.ink }]}>
                Let this memory go?
              </Text>
              <Text style={[styles.confirmBody, { color: theme.colors.muted }]}>
                The photo and its story will be lifted out of your box. You get a few seconds to
                put it back.
              </Text>
              <View style={styles.confirmActions}>
                <PressableScale
                  accessibilityLabel="Keep this memory"
                  haptic="tap"
                  onPress={() => {
                    setConfirmingDelete(false);
                  }}
                  style={[
                    styles.confirmKeep,
                    {
                      backgroundColor: theme.colors.surfaceRaised,
                      borderColor: theme.colors.borderStrong,
                    },
                  ]}
                >
                  <Text style={[styles.confirmKeepText, { color: theme.colors.inkSoft }]}>
                    Keep it
                  </Text>
                </PressableScale>
                <PressableScale
                  accessibilityLabel="Let this memory go"
                  haptic="none"
                  onPress={letGo}
                  style={[styles.confirmDelete, { backgroundColor: theme.colors.danger }]}
                >
                  <Text style={styles.confirmDeleteText}>Let it go</Text>
                </PressableScale>
              </View>
            </Animated.View>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  confirmOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(10,7,5,0.42)',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  confirmCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
    width: '100%',
  },
  confirmKicker: {
    fontFamily: fonts.handBold,
    fontSize: 18,
    lineHeight: 20,
  },
  confirmTitle: {
    fontFamily: fonts.serif,
    fontSize: 23,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  confirmBody: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 6,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  confirmKeep: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  confirmKeepText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
  },
  confirmDelete: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    paddingVertical: 11,
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontFamily: fonts.sansBold,
    fontSize: 13,
  },
  keyboard: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 2,
  },
  grabberWrap: {
    alignItems: 'center',
    flex: 1,
    paddingLeft: 26,
  },
  grabber: {
    borderRadius: 999,
    height: 4,
    maxWidth: 64,
    width: '38%',
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  topActionsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  cardWrap: {
    marginVertical: 6,
  },
  editPanel: {
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: 14,
    padding: 14,
    width: '100%',
  },
  editLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  titleInput: {
    borderRadius: radii.sm,
    borderWidth: 1,
    fontFamily: fonts.handBold,
    fontSize: 20,
    marginTop: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  moodRow: {
    gap: 6,
    paddingTop: 6,
    paddingBottom: 2,
  },
  moodChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  moodEmoji: {
    fontSize: 11,
  },
  moodText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
  },
  locationPill: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingLeft: 11,
    paddingRight: 2,
    paddingVertical: 2,
  },
  locationText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11.5,
    maxWidth: 180,
  },
  locationButtonWrap: {
    marginLeft: 2,
  },
  editHint: {
    fontFamily: fonts.hand,
    fontSize: 15,
    marginTop: 8,
  },
  hint: {
    fontFamily: fonts.hand,
    fontSize: 18,
    marginTop: 14,
  },
});
