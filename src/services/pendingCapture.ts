import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { extractExifDate } from '@/services/locationService';
import { persistMemoryImage } from '@/services/fileStorage';
import { useMemoryStore } from '@/store/useMemoryStore';

/**
 * Android can kill the activity while the system picker is open. Expo keeps the
 * result and hands it back on the next launch; rescue it into the box instead of
 * silently dropping the photo.
 */
export async function handlePendingImagePickerResult(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const result = await ImagePicker.getPendingResultAsync();
    if (!result || !('assets' in result) || !result.assets || result.assets.length === 0) {
      return;
    }
    const asset = result.assets[0];
    if (!asset || asset.type === 'video') return;

    const store = useMemoryStore.getState();
    if (!store.hasHydrated) return;

    const imageUri = await persistMemoryImage(asset.uri);
    store.addMemory({
      imageUri,
      shortTitle: 'A moment rescued from the camera roll',
      description: '',
      location: null,
      moodTag: 'nostalgic',
      dateCreated: extractExifDate(asset.exif as Record<string, unknown> | null) ?? undefined,
      imageWidth: asset.width ?? null,
      imageHeight: asset.height ?? null,
    });
  } catch {
    // Recovery is best-effort; never block app start.
  }
}
