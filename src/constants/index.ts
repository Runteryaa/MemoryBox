import type { MoodOption, MoodTag } from '@/types';

export const MOODS: MoodOption[] = [
  { id: 'happy', label: 'Happy', emoji: '☀️', color: '#F59E0B', soft: '#FEF3C7' },
  { id: 'cozy', label: 'Cozy', emoji: '🧸', color: '#C2410C', soft: '#FFEDD5' },
  { id: 'grateful', label: 'Grateful', emoji: '🌷', color: '#BE123C', soft: '#FFE4E6' },
  { id: 'excited', label: 'Excited', emoji: '✨', color: '#7C3AED', soft: '#EDE9FE' },
  { id: 'peaceful', label: 'Peaceful', emoji: '🍃', color: '#4D7C0F', soft: '#ECFCCB' },
  { id: 'nostalgic', label: 'Nostalgic', emoji: '🎞️', color: '#64748B', soft: '#E2E8F0' },
];

export const MOOD_MAP = Object.fromEntries(
  MOODS.map((mood) => [mood.id, mood])
) as Record<MoodTag, MoodOption>;

export const MAX_TITLE_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 1500;

export const MILESTONE_DEFINITIONS = [
  {
    id: 'first-keepsake',
    title: 'First Keepsake',
    description: 'Tuck away your very first memory.',
    emoji: '🎁',
    target: '1 memory',
  },
  {
    id: 'week-storyteller',
    title: '7-Day Storyteller',
    description: 'Keep a story alive for seven days in a row.',
    emoji: '📖',
    target: '7-day streak',
  },
  {
    id: 'globe-trotter',
    title: 'Globe Trotter',
    description: 'Remember five different places.',
    emoji: '🌍',
    target: '5 places',
  },
  {
    id: 'deep-diver',
    title: 'Deep Diver',
    description: 'Write a long, heartfelt story on the back of a photo.',
    emoji: '🖋️',
    target: '300+ characters',
  },
  {
    id: 'collector',
    title: 'Little Collector',
    description: 'Gather ten precious moments in your box.',
    emoji: '🗃️',
    target: '10 memories',
  },
  {
    id: 'mood-keeper',
    title: 'Mood Keeper',
    description: 'Capture memories in every mood.',
    emoji: '🌈',
    target: 'All 6 moods',
  },
] as const;

export type MilestoneId = (typeof MILESTONE_DEFINITIONS)[number]['id'];
