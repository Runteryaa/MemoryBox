import { create } from 'zustand';

import { createPersistStorage } from '@/store/storage';
import type { ThemeMode } from '@/types';

interface SettingsStore {
  themeMode: ThemeMode;
  hasHydrated: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  /** Remembered so the gallery opens the way you left it. */
  galleryMode: 'pile' | 'grid';
  gallerySort: string;
  setGalleryMode: (mode: 'pile' | 'grid') => void;
  setGallerySort: (sort: string) => void;
}

export const useSettingsStore = create<SettingsStore>()((set) => ({
  themeMode: 'system',
  hasHydrated: false,
  galleryMode: 'pile',
  gallerySort: 'newest',
  setThemeMode: (mode) => set({ themeMode: mode }),
  setGalleryMode: (mode) => set({ galleryMode: mode }),
  setGallerySort: (sort) => set({ gallerySort: sort }),
}));

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
        galleryMode: state.galleryMode,
        gallerySort: state.gallerySort,
      })
    );
  }, 200);
});
