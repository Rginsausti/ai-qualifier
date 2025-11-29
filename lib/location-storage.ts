export type StoredLocation = {
  lat: number;
  lon: number;
  label?: string;
  source?: "gps" | "manual";
  savedAt?: string;
  formattedAddress?: string;
};

const STORAGE_KEY = "alma:lastLocation";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const loadStoredLocation = (): StoredLocation | null => {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredLocation>;
    if (typeof parsed.lat !== "number" || typeof parsed.lon !== "number") {
      return null;
    }
    return {
      lat: parsed.lat,
      lon: parsed.lon,
      label: parsed.label,
      source: parsed.source,
      savedAt: parsed.savedAt,
      formattedAddress: parsed.formattedAddress,
    };
  } catch {
    return null;
  }
};

export const saveStoredLocation = (location: StoredLocation) => {
  if (!isBrowser()) return;
  try {
    const payload: StoredLocation = {
      ...location,
      savedAt: location.savedAt ?? new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures silently
  }
};

export const clearStoredLocation = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
};
