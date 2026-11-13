import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { diffCalendarDays, toDateKey } from '@/lib/date';
import { createId, randomRotation } from '@/lib/random';
import { deleteMemoryImage } from '@/services/fileStorage';
import { createPersistStorage } from '@/store/storage';
import type { Memory, MemoryLocation, MoodTag, NewMemoryInput, StreakState } from '@/types';

export interface MemoryFilters {
  query: string;
  mood: MoodTag | 'all';
  city: string | 'all';
}

interface MemoryStore {
  memories: Memory[];
  streak: StreakState;
  hasHydrated: boolean;
  pendingCelebration: number | null;

  markHydrated: () => void;
  evaluateStreak: () => void;
  addMemory: (input: NewMemoryInput) => Memory;
  updateMemory: (id: string, patch: Partial<Omit<Memory, 'id'>>) => void;
  updateLocation: (id: string, location: MemoryLocation | null) => void;
  toggleFavorite: (id: string) => void;
  deleteMemory: (id: string) => Promise<void>;
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
        set((state) => ({
          memories: state.memories.filter((item) => item.id !== id),
        }));
        if (memory) {
          await deleteMemoryImage(memory.imageUri);
        }
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

export function filterMemories(memories: Memory[], filters: MemoryFilters): Memory[] {
  const query = filters.query.trim().toLowerCase();
  return memories.filter((memory) => {
    if (filters.mood !== 'all' && memory.moodTag !== filters.mood) return false;
    if (filters.city !== 'all') {
      const locationText = `${memory.location?.city ?? ''} ${
        memory.location?.placeName ?? ''
      }`.toLowerCase();
      if (!locationText.includes(filters.city.toLowerCase())) return false;
    }
    if (!query) return true;
    const haystack = [
      memory.shortTitle,
      memory.description,
      memory.location?.placeName ?? '',
      memory.location?.city ?? '',
      memory.location?.country ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
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
