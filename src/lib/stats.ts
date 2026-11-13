import { MOODS } from '@/constants';
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
    if (memory.location?.placeName) {
      places.add(memory.location.placeName.trim().toLowerCase());
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

export function getDistinctCities(memories: Memory[]): string[] {
  const cities = new Set<string>();
  for (const memory of memories) {
    const city = memory.location?.city ?? memory.location?.placeName?.split(',')[0];
    if (city) cities.add(city.trim());
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
