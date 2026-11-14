import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { MOOD_MAP } from '@/constants';
import { diffCalendarDays, toDateKey } from '@/lib/date';
import { createId, randomRotation } from '@/lib/random';
import { deleteMemoryImage } from '@/services/fileStorage';
import { createPersistStorage } from '@/store/storage';
import type { Memory, MemoryLocation, MoodTag, NewMemoryInput, StreakState } from '@/types';

export interface MemoryFilters {
  query: string;
  mood: MoodTag | 'all';
  city: string | 'all';
  sort?: MemorySort;
  onlyLoved?: boolean;
}

export type MemorySort = 'newest' | 'oldest' | 'loved' | 'title';

interface MemoryStore {
  memories: Memory[];
  streak: StreakState;
  hasHydrated: boolean;
  pendingCelebration: number | null;
  /** The most recent memory let go, kept briefly so it can be taken back. */
  trash: Memory | null;

  markHydrated: () => void;
  evaluateStreak: () => void;
  addMemory: (input: NewMemoryInput) => Memory;
  updateMemory: (id: string, patch: Partial<Omit<Memory, 'id'>>) => void;
  updateLocation: (id: string, location: MemoryLocation | null) => void;
  toggleFavorite: (id: string) => void;
  deleteMemory: (id: string) => Promise<void>;
  restoreTrash: () => void;
  dismissTrash: () => void;
  clearCelebration: () => void;
}

const emptyStreak: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastLoggedDate: null,
  loggedDates: [],
};

function uniqueSortedDates(dates: string[]): string[] {
  return [...new Set(dates)].sort((a, b) => a.localeCompare(b));
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      streak: emptyStreak,
      hasHydrated: false,
      pendingCelebration: null,
      trash: null,

      markHydrated: () => set({ hasHydrated: true }),

      evaluateStreak: () => {
        const { streak } = get();
        const today = toDateKey();
        let currentStreak = streak.currentStreak;
        let lastLoggedDate = streak.lastLoggedDate;

        if (!lastLoggedDate) {
          currentStreak = 0;
        } else {
          const gap = diffCalendarDays(lastLoggedDate, today);
          if (gap < 0) {
            // Device clock moved backwards; keep the streak but trust the latest date.
            lastLoggedDate = today;
            currentStreak = Math.max(1, currentStreak);
          } else if (gap > 1) {
            currentStreak = 0;
          } else {
            currentStreak = Math.max(1, currentStreak);
          }
        }

        const longestStreak = Math.max(streak.longestStreak, currentStreak);
        if (
          currentStreak !== streak.currentStreak ||
          longestStreak !== streak.longestStreak ||
          lastLoggedDate !== streak.lastLoggedDate
        ) {
          set({
            streak: {
              ...streak,
              currentStreak,
              longestStreak,
              lastLoggedDate,
            },
            pendingCelebration: null,
          });
        }
      },

      addMemory: (input) => {
        const memory: Memory = {
          id: input.id ?? createId(),
          imageUri: input.imageUri,
          shortTitle: input.shortTitle.trim().slice(0, 60) || 'A little moment',
          description: input.description.trim().slice(0, 1500),
          location: input.location,
          dateCreated: input.dateCreated ?? new Date().toISOString(),
          moodTag: input.moodTag,
          rotationAngle: randomRotation(-6, 6),
          isFavorite: input.isFavorite ?? false,
          imageWidth: input.imageWidth ?? null,
          imageHeight: input.imageHeight ?? null,
        };

        const today = toDateKey();
        const { streak, memories } = get();
        const alreadyLoggedToday = streak.lastLoggedDate === today;

        let currentStreak = streak.currentStreak;
        let celebration: number | null = null;

        if (!alreadyLoggedToday) {
          const gap = streak.lastLoggedDate
            ? diffCalendarDays(streak.lastLoggedDate, today)
            : null;
          currentStreak = gap === 1 ? Math.max(1, streak.currentStreak + 1) : 1;
          celebration = currentStreak;
        } else {
          currentStreak = Math.max(1, streak.currentStreak);
        }

        const loggedDates = alreadyLoggedToday
          ? uniqueSortedDates(streak.loggedDates)
          : uniqueSortedDates([...streak.loggedDates, today]);

        const nextStreak: StreakState = {
          currentStreak,
          longestStreak: Math.max(streak.longestStreak, currentStreak),
          lastLoggedDate: today,
          loggedDates,
        };

        set({
          memories: [memory, ...memories],
          streak: nextStreak,
          pendingCelebration: celebration,
        });

        return memory;
      },

      updateMemory: (id, patch) =>
        set((state) => ({
          memories: state.memories.map((memory) =>
            memory.id === id
              ? {
                  ...memory,
                  ...patch,
                  shortTitle:
                    patch.shortTitle !== undefined
                      ? patch.shortTitle.trim().slice(0, 60)
                      : memory.shortTitle,
                  description:
                    patch.description !== undefined
                      ? patch.description.trim().slice(0, 1500)
                      : memory.description,
                }
              : memory
          ),
        })),

      updateLocation: (id, location) =>
        set((state) => ({
          memories: state.memories.map((memory) =>
            memory.id === id ? { ...memory, location } : memory
          ),
        })),

      toggleFavorite: (id) =>
        set((state) => ({
          memories: state.memories.map((memory) =>
            memory.id === id ? { ...memory, isFavorite: !memory.isFavorite } : memory
          ),
        })),

      deleteMemory: async (id) => {
        const memory = get().memories.find((item) => item.id === id);
        const previous = get().trash;
        set((state) => ({
          memories: state.memories.filter((item) => item.id !== id),
          trash: memory ?? null,
        }));
        // Only one memory can sit in the undo window, so a second delete has to
        // release the first one's photo right away instead of orphaning it.
        if (previous && previous.id !== memory?.id) {
          void deleteMemoryImage(previous.imageUri);
        }
        // The photo stays on disk until the undo window closes, so a mis-tap is recoverable.
        if (memory) {
          setTimeout(() => {
            if (get().trash?.id === memory.id) {
              void deleteMemoryImage(memory.imageUri);
              set({ trash: null });
            }
          }, 8000);
        }
      },

      restoreTrash: () => {
        const { trash } = get();
        if (!trash) return;
        set((state) => ({
          trash: null,
          memories: [trash, ...state.memories.filter((item) => item.id !== trash.id)],
        }));
      },

      dismissTrash: () => {
        const { trash } = get();
        if (!trash) return;
        void deleteMemoryImage(trash.imageUri);
        set({ trash: null });
      },

      clearCelebration: () => set({ pendingCelebration: null }),
    }),
    {
      name: 'memory-box-store-v1',
      storage: createJSONStorage(() => createPersistStorage()),
      partialize: (state) => ({
        memories: state.memories,
        streak: state.streak,
      }),
      onRehydrateStorage: () => (_state, error) => {
        useMemoryStore.setState({ hasHydrated: true });
        if (error) return;
        useMemoryStore.getState().evaluateStreak();
      },
    }
  )
);

/** Month names and years are worth searching too, so a memory can be found by when it happened. */
const dateSearchCache = new Map<string, string>();

function searchableDate(iso: string): string {
  const cached = dateSearchCache.get(iso);
  if (cached) return cached;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const text = [
    date.toLocaleDateString(undefined, { month: 'long' }),
    date.toLocaleDateString(undefined, { month: 'short' }),
    String(date.getFullYear()),
  ].join(' ');
  dateSearchCache.set(iso, text);
  return text;
}

export function filterMemories(memories: Memory[], filters: MemoryFilters): Memory[] {
  const query = filters.query.trim().toLowerCase();
  // Every word counts, so "paris rain" finds a rainy day in Paris even when
  // those two facts live in different fields.
  const tokens = query ? query.split(/\s+/).filter(Boolean) : [];
  const matched = memories.filter((memory) => {
    if (filters.onlyLoved && !memory.isFavorite) return false;
    if (filters.mood !== 'all' && memory.moodTag !== filters.mood) return false;
    if (filters.city !== 'all') {
      const locationText = `${memory.location?.city ?? ''} ${
        memory.location?.placeName ?? ''
      }`.toLowerCase();
      if (!locationText.includes(filters.city.toLowerCase())) return false;
    }
    if (tokens.length === 0) return true;
    const mood = MOOD_MAP[memory.moodTag];
    const haystack = [
      memory.shortTitle,
      memory.description,
      memory.location?.placeName ?? '',
      memory.location?.city ?? '',
      memory.location?.country ?? '',
      // Searching a feeling should find the memories that felt that way.
      mood?.label ?? memory.moodTag,
      memory.isFavorite ? 'loved favourite favorite heart' : '',
      searchableDate(memory.dateCreated),
    ]
      .join(' ')
      .toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });

  return sortMemories(matched, filters.sort ?? 'newest');
}

/** Ordering lives in one place so the pile, grid and counters always agree. */
export function sortMemories(memories: Memory[], sort: MemorySort): Memory[] {
  if (sort === 'newest' || sort === 'oldest') {
    const direction = sort === 'newest' ? -1 : 1;
    return [...memories].sort(
      (a, b) => direction * (a.dateCreated.localeCompare(b.dateCreated))
    );
  }
  if (sort === 'loved') {
    return [...memories].sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return b.dateCreated.localeCompare(a.dateCreated);
    });
  }
  return [...memories].sort((a, b) =>
    a.shortTitle.localeCompare(b.shortTitle, undefined, { sensitivity: 'base' })
  );
}

export function getMemoryStreakStatus(streak: StreakState) {
  const today = toDateKey();
  if (!streak.lastLoggedDate) {
    return { loggedToday: false, alive: false, pendingToday: false, gap: null as number | null };
  }
  const gap = diffCalendarDays(streak.lastLoggedDate, today);
  return {
    loggedToday: gap === 0,
    alive: gap <= 1,
    pendingToday: gap === 1,
    gap,
  };
}
