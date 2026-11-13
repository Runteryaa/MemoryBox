import Storage from 'expo-sqlite/kv-store';

export interface PersistStorage {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
}

/**
 * SQLite-backed key/value storage from expo-sqlite.
 * Queued writes keep rapid store updates (capture flow, editing) ordered.
 */
export function createPersistStorage(): PersistStorage {
  let writeQueue: Promise<unknown> = Promise.resolve();

  return {
    getItem: (name) => Storage.getItem(name),
    setItem: (name, value) => {
      writeQueue = writeQueue
        .catch(() => undefined)
        .then(() => Storage.setItem(name, value));
      return writeQueue as Promise<void>;
    },
    removeItem: (name) => {
      writeQueue = writeQueue
        .catch(() => undefined)
        .then(() => Storage.removeItem(name));
      return writeQueue as Promise<void>;
    },
  };
}
