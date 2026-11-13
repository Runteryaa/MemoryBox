import * as Crypto from 'expo-crypto';

export function createId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    // Extremely defensive fallback for older runtimes.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function randomRotation(min = -6, max = 6): number {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

export function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function pickRandom<T>(items: readonly T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}
