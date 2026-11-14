import { useColorScheme } from 'react-native';
import { create } from 'zustand';

import { createPersistStorage } from '@/store/storage';
import type { ThemeMode } from '@/types';

interface SettingsStore {
  themeMode: ThemeMode;
  hasHydrated: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  cycleThemeMode: () => void;
  hasSeenIntro: boolean;
  completeIntro: () => void;
  /** Remembered so the gallery opens the way you left it. */
  galleryMode: 'pile' | 'grid';
  gallerySort: string;
  setGalleryMode: (mode: 'pile' | 'grid') => void;
  setGallerySort: (sort: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  (set, get) => ({
    themeMode: 'system',
    hasHydrated: false,
    hasSeenIntro: false,
    galleryMode: 'pile',
    gallerySort: 'newest',
    setThemeMode: (mode) => set({ themeMode: mode }),
    setGalleryMode: (mode) => set({ galleryMode: mode }),
    setGallerySort: (sort) => set({ gallerySort: sort }),
    cycleThemeMode: () => {
      const mode = get().themeMode;
      const next: ThemeMode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
      set({ themeMode: next });
    },
    completeIntro: () => set({ hasSeenIntro: true }),
  })
);

// Settings are intentionally not persisted with middleware to keep the store
// synchronous at first paint; they hydrate from the same SQLite kv store.
const storage = createPersistStorage();
const SETTINGS_KEY = 'memory-box-settings-v1';

export async function hydrateSettings() {
  try {
    const raw = await storage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SettingsStore>;
      useSettingsStore.setState({
        themeMode: parsed.themeMode === 'light' || parsed.themeMode === 'dark' ? parsed.themeMode : 'system',
        hasSeenIntro: parsed.hasSeenIntro ?? false,
        galleryMode: parsed.galleryMode === 'grid' ? 'grid' : 'pile',
        gallerySort:
          parsed.gallerySort === 'oldest' ||
          parsed.gallerySort === 'loved' ||
          parsed.gallerySort === 'title'
            ? parsed.gallerySort
            : 'newest',
      });
    }
  } catch {
    // Corrupt or unavailable storage should never block the app.
  } finally {
    useSettingsStore.setState({ hasHydrated: true });
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
useSettingsStore.subscribe((state) => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void storage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        themeMode: state.themeMode,
        hasSeenIntro: state.hasSeenIntro,
        galleryMode: state.galleryMode,
        gallerySort: state.gallerySort,
      })
    );
  }, 200);
});

export function useResolvedScheme() {
  const scheme = useColorScheme();
  const mode = useSettingsStore((state) => state.themeMode);
  return mode === 'system' ? scheme ?? 'light' : mode;
}
