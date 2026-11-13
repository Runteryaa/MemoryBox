import * as Location from 'expo-location';

import type { MemoryLocation } from '@/types';

export type LocationFailureCode = 'denied' | 'services-disabled' | 'timeout' | 'unknown';

export class LocationFailure extends Error {
  code: LocationFailureCode;

  constructor(code: LocationFailureCode, message: string) {
    super(message);
    this.name = 'LocationFailure';
    this.code = code;
  }
}

const PLACE_FALLBACK = 'A Place Worth Remembering';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new LocationFailure('timeout', 'Location took too long to arrive.'));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildPlaceName(address: Location.LocationGeocodedAddress | null): string {
  if (!address) return PLACE_FALLBACK;
  const district = clean(address.district);
  const city = clean(address.city);
  const region = clean(address.region);
  const name = clean(address.name);
  const street = clean(address.street);

  if (district && city && district.toLowerCase() !== city.toLowerCase()) {
    return `${district}, ${city}`;
  }
  if (city) return city;
  if (name) return name;
  if (region) return region;
  if (street) return street;
  return PLACE_FALLBACK;
}

async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<Location.LocationGeocodedAddress | null> {
  try {
    const addresses = await withTimeout(
      Location.reverseGeocodeAsync({ latitude, longitude }),
      5500
    );
    return addresses[0] ?? null;
  } catch {
    return null;
  }
}

export async function detectCurrentPlace(): Promise<MemoryLocation> {
  let servicesEnabled = true;
  try {
    servicesEnabled = await Location.hasServicesEnabledAsync();
  } catch {
    // Ignore and let the permission request surface a clearer failure.
  }
  if (!servicesEnabled) {
    throw new LocationFailure('services-disabled', 'Turn on location services to add a place.');
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new LocationFailure('denied', 'Location permission is needed to stamp this memory.');
  }

  let position: Location.LocationObject | null = null;
  try {
    position = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
  } catch {
    position = null;
  }

  if (!position) {
    try {
      position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        12000
      );
    } catch (error) {
      if (error instanceof LocationFailure) throw error;
      throw new LocationFailure('unknown', 'We could not find your location right now.');
    }
  }

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  return createMemoryLocation(latitude, longitude);
}

export async function createMemoryLocation(
  latitude: number,
  longitude: number
): Promise<MemoryLocation> {
  const address = await reverseGeocode(latitude, longitude);
  return {
    latitude,
    longitude,
    placeName: buildPlaceName(address),
    city: clean(address?.city) ?? clean(address?.region),
    country: clean(address?.country),
  };
}

/**
 * Read GPS coordinates from EXIF data. Supports both decimal numbers and
 * the rational/string forms returned by different picker implementations.
 */
export function extractExifLocation(
  exif: Record<string, unknown> | null | undefined
): { latitude: number; longitude: number } | null {
  if (!exif) return null;

  const latValue =
    exif.GPSLatitude ?? exif.gpsLatitude ?? exif.latitude ?? exif.Latitude ?? null;
  const lonValue =
    exif.GPSLongitude ?? exif.gpsLongitude ?? exif.longitude ?? exif.Longitude ?? null;

  const latitude = toDecimalDegrees(latValue);
  const longitude = toDecimalDegrees(lonValue);

  if (
    latitude == null ||
    longitude == null ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    return null;
  }

  const latRef = String(exif.GPSLatitudeRef ?? exif.gpsLatitudeRef ?? '').toUpperCase();
  const lonRef = String(exif.GPSLongitudeRef ?? exif.gpsLongitudeRef ?? '').toUpperCase();
  return {
    latitude: latRef === 'S' ? -Math.abs(latitude) : latitude,
    longitude: lonRef === 'W' ? -Math.abs(longitude) : longitude,
  };
}

function toDecimalDegrees(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parts = value
      .replace(/[^\d.,\-]/g, ' ')
      .split(/[\s,]+/)
      .map(Number)
      .filter((part) => !Number.isNaN(part));
    if (parts.length === 0) return null;
    const [deg = 0, min = 0, sec = 0] = parts;
    return deg + min / 60 + sec / 3600;
  }
  if (Array.isArray(value)) {
    const [deg = 0, min = 0, sec = 0] = value.map((part) =>
      typeof part === 'number' ? part : Number(part) || 0
    );
    return deg + min / 60 + sec / 3600;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const numerator = Number(record.numerator ?? record.n);
    const denominator = Number(record.denominator ?? record.d) || 1;
    if (!Number.isNaN(numerator)) return numerator / denominator;
  }
  return null;
}

export function extractExifDate(
  exif: Record<string, unknown> | null | undefined
): string | null {
  if (!exif) return null;
  const raw =
    exif.DateTimeOriginal ??
    exif.dateTimeOriginal ??
    exif.DateTime ??
    exif.dateTime ??
    exif.DateTimeDigitized ??
    null;
  if (typeof raw !== 'string') return null;
  // EXIF format: "2024:05:18 14:32:10"
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatCoordinatesShort(location: MemoryLocation): string {
  if (location.latitude == null || location.longitude == null) return '';
  return `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
}

export function locationErrorMessage(error: unknown): string {
  if (error instanceof LocationFailure) {
    switch (error.code) {
      case 'denied':
        return 'Location permission is off. You can still name this place yourself.';
      case 'services-disabled':
        return 'Location services are off. Add the place name by hand instead.';
      case 'timeout':
        return 'The satellites are taking a nap. Try again or type the place.';
      default:
        return 'We could not find your location. Type a place name instead.';
    }
  }
  return 'Something went wrong while finding your location.';
}
