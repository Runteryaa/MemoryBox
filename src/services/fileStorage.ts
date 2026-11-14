import { Directory, File, Paths } from 'expo-file-system';

import { createId } from '@/lib/random';

const MEMORIES_FOLDER = 'memories';

function memoriesDirectory(): Directory {
  return new Directory(Paths.document, MEMORIES_FOLDER);
}

export function ensureMemoriesDirectory(): Directory {
  const directory = memoriesDirectory();
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

function safeExtension(uri: string, fallback = '.jpg'): string {
  const cleaned = uri.split('?')[0] ?? uri;
  const match = cleaned.match(/\.([a-zA-Z0-9]{2,5})$/);
  if (!match) return fallback;
  const extension = `.${match[1]?.toLowerCase()}`;
  if (['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'].includes(extension)) {
    return extension === '.jpeg' ? '.jpg' : extension;
  }
  return fallback;
}

/** Copy a temporary camera/picker image into the app's permanent documents folder. */
export async function persistMemoryImage(sourceUri: string): Promise<string> {
  ensureMemoriesDirectory();
  const extension = safeExtension(sourceUri);
  const destination = new File(memoriesDirectory(), `${createId()}${extension}`);

  try {
    await new File(sourceUri).copy(destination, { overwrite: true });
  } catch {
    // Some Android content:// providers cannot be copied directly; fall back to bytes.
    const source = new File(sourceUri);
    const bytes = await source.bytes();
    destination.create({ overwrite: true, intermediates: true });
    await destination.write(bytes);
  }

  return destination.uri;
}

export async function deleteMemoryImage(uri: string): Promise<void> {
  try {
    if (!uri.startsWith('file://')) return;
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A missing file should never block deleting metadata.
  }
}

export function memoryImageExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/**
 * Photos are copied into the app's folder as soon as they are captured, so a
 * crash or a kill mid-arrange can leave a file that no memory points to. Sweep
 * those away once at launch; anything still referenced is left untouched.
 */
export function pruneOrphanedImages(activeUris: readonly string[]): number {
  const directory = memoriesDirectory();
  if (!directory.exists) return 0;
  const keep = new Set(
    activeUris.map((uri) => {
      const cleaned = uri.split('?')[0] ?? uri;
      return cleaned.split('/').pop() ?? cleaned;
    })
  );
  let removed = 0;
  let entries: ReturnType<Directory['list']>;
  try {
    entries = directory.list();
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (!(entry instanceof File)) continue;
    if (keep.has(entry.name)) continue;
    try {
      entry.delete();
      removed += 1;
    } catch {
      // A file that refuses to go is harmless; the next launch can try again.
    }
  }
  return removed;
}
