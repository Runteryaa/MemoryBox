import { FALLBACK_PLACE_NAME, MOODS } from '@/constants';
import { toDateKey } from '@/lib/date';
import type { MilestoneId } from '@/constants';
import type { Memory } from '@/types';

export interface MemoryStats {
  totalMemories: number;
  distinctPlaces: number;
  distinctCities: number;
  favorites: number;
  memoriesThisMonth: number;
  moodsUsed: number;
}

export function getStats(memories: Memory[], now = new Date()): MemoryStats {
  const places = new Set<string>();
  const cities = new Set<string>();
  const moods = new Set<string>();
  const monthKey = toDateKey(now).slice(0, 7);
  let favorites = 0;
  let memoriesThisMonth = 0;

  for (const memory of memories) {
    // A city on its own still counts as a place worth remembering.
    const namedPlace = memory.location?.placeName?.trim();
    const place =
      namedPlace && namedPlace !== FALLBACK_PLACE_NAME ? namedPlace : memory.location?.city?.trim();
    if (place) {
      places.add(place.toLowerCase());
    } else if (memory.location?.latitude != null && memory.location?.longitude != null) {
      // A pin without a name is still a distinct place on the map.
      places.add(
        `${memory.location.latitude.toFixed(3)},${memory.location.longitude.toFixed(3)}`
      );
    }
    if (memory.location?.city) {
      cities.add(memory.location.city.trim().toLowerCase());
    }
    moods.add(memory.moodTag);
    if (memory.isFavorite) favorites += 1;
    if (toDateKey(new Date(memory.dateCreated)).startsWith(monthKey)) {
      memoriesThisMonth += 1;
    }
  }

  return {
    totalMemories: memories.length,
    distinctPlaces: places.size,
    distinctCities: cities.size,
    favorites,
    memoriesThisMonth,
    moodsUsed: moods.size,
  };
}

export function getMemoryCity(memory: Memory): string | null {
  const raw = memory.location?.city ?? memory.location?.placeName?.split(',')[0];
  if (!raw) return null;
  const trimmed = raw.trim();
  // A failed lookup leaves a placeholder, not a city worth filtering by.
  if (!trimmed || trimmed === FALLBACK_PLACE_NAME) return null;
  return trimmed;
}

export function getDistinctCities(memories: Memory[]): string[] {
  const cities = new Set<string>();
  for (const memory of memories) {
    const city = getMemoryCity(memory);
    if (city) cities.add(city);
  }
  return [...cities].sort((a, b) => a.localeCompare(b));
}

export function getMemoriesByDate(memories: Memory[]): Map<string, Memory[]> {
  const map = new Map<string, Memory[]>();
  for (const memory of memories) {
    const key = toDateKey(new Date(memory.dateCreated));
    const list = map.get(key) ?? [];
    list.push(memory);
    map.set(key, list);
  }
  return map;
}

export function getMilestones(memories: Memory[], longestStreak: number) {
  const stats = getStats(memories);
  const hasLongStory = memories.some((memory) => memory.description.trim().length >= 300);
  const moodCount = new Set(memories.map((memory) => memory.moodTag)).size;
  return {
    'first-keepsake': stats.totalMemories >= 1,
    'week-storyteller': longestStreak >= 7,
    'globe-trotter': stats.distinctPlaces >= 5,
    'deep-diver': hasLongStory,
    collector: stats.totalMemories >= 10,
    'mood-keeper': moodCount >= MOODS.length,
  } satisfies Record<MilestoneId, boolean>;
}

/** How far along each stamp is, so locked badges can show a little progress. */
export function getMilestoneProgress(memories: Memory[], longestStreak: number) {
  const stats = getStats(memories);
  const longestStory = memories.reduce(
    (longest, memory) => Math.max(longest, memory.description.trim().length),
    0
  );
  const moodCount = new Set(memories.map((memory) => memory.moodTag)).size;
  return {
    'first-keepsake': { current: Math.min(stats.totalMemories, 1), goal: 1 },
    'week-storyteller': { current: Math.min(longestStreak, 7), goal: 7 },
    'globe-trotter': { current: Math.min(stats.distinctPlaces, 5), goal: 5 },
    'deep-diver': { current: Math.min(longestStory, 300), goal: 300 },
    collector: { current: Math.min(stats.totalMemories, 10), goal: 10 },
    'mood-keeper': { current: moodCount, goal: MOODS.length },
  } satisfies Record<MilestoneId, { current: number; goal: number }>;
}

/**
 * Memories from this same calendar day in earlier years. The heart of a memory
 * box is looking back, so the app should resurface them without being asked.
 */
export function getOnThisDay(memories: Memory[], now = new Date()): Memory[] {
  const month = now.getMonth();
  const day = now.getDate();
  const year = now.getFullYear();
  return memories
    .filter((memory) => {
      const date = new Date(memory.dateCreated);
      return (
        date.getMonth() === month && date.getDate() === day && date.getFullYear() < year
      );
    })
    .sort((a, b) => b.dateCreated.localeCompare(a.dateCreated));
}
