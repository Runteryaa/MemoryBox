export type MoodTag =
  | 'happy'
  | 'cozy'
  | 'grateful'
  | 'excited'
  | 'peaceful'
  | 'nostalgic';

export interface MemoryLocation {
  latitude: number | null;
  longitude: number | null;
  placeName: string;
  city: string | null;
  country: string | null;
}

export interface Memory {
  id: string;
  imageUri: string;
  shortTitle: string;
  description: string;
  location: MemoryLocation | null;
  dateCreated: string;
  moodTag: MoodTag;
  rotationAngle: number;
  isFavorite: boolean;
  /** Pixel size recorded at capture time so a card can frame the photo before it decodes. */
  imageWidth?: number | null;
  imageHeight?: number | null;
}

export interface NewMemoryInput {
  id?: string;
  imageUri: string;
  shortTitle: string;
  description: string;
  location: MemoryLocation | null;
  dateCreated?: string;
  moodTag: MoodTag;
  isFavorite?: boolean;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastLoggedDate: string | null;
  loggedDates: string[];
}

export type ThemeMode = 'system' | 'light' | 'dark';

export type WeekDayLetter = 'M' | 'T' | 'W' | 'T' | 'F' | 'S' | 'S';

export interface MoodOption {
  id: MoodTag;
  label: string;
  emoji: string;
  color: string;
  soft: string;
}
