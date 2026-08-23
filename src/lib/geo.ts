/** Географические константы и утилиты. Пилот — Уральск, ЗКО. */

export const URALSK: {
  name: string;
  lat: number;
  lng: number;
  zoom: number;
} = {
  name: "Уральск",
  lat: 51.2333,
  lng: 51.3667,
  zoom: 12.2,
};

/**
 * Рамка пилотной зоны. Сообщения за её пределами не принимаем:
 * на MVP плотность данных важнее охвата.
 */
export const PILOT_BOUNDS = {
  minLat: 50.95,
  maxLat: 51.5,
  minLng: 51.0,
  maxLng: 51.75,
} as const;

export function insidePilot(lat: number, lng: number): boolean {
  return (
    lat >= PILOT_BOUNDS.minLat &&
    lat <= PILOT_BOUNDS.maxLat &&
    lng >= PILOT_BOUNDS.minLng &&
    lng <= PILOT_BOUNDS.maxLng
  );
}

/** Расстояние между двумя точками в метрах (формула гаверсинуса). */
export function distanceM(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number, locale: string): string {
  if (m < 1000) {
    return locale === "en" ? `${Math.round(m)} m` : `${Math.round(m)} м`;
  }
  const km = (m / 1000).toFixed(m < 10000 ? 1 : 0);
  return locale === "en" ? `${km} km` : `${km} км`;
}

/**
 * Обратное геокодирование через Nominatim (OpenStreetMap).
 * Без ключа. Вызываем только по действию пользователя, не в цикле.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  lang = "ru",
): Promise<string | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=${lang}`;
    const res = await fetch(url, {
      headers: { "Accept-Language": lang },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    const parts = [
      a.road ?? a.pedestrian ?? a.residential ?? a.suburb,
      a.house_number,
    ].filter(Boolean);
    if (parts.length) return parts.join(", ");
    return data.name || data.display_name?.split(",").slice(0, 2).join(",") || null;
  } catch {
    return null;
  }
}

/** Прямой геокодинг — поиск адреса в пилотной зоне. */
export async function geocode(
  query: string,
  lang = "ru",
): Promise<{ label: string; lat: number; lng: number }[]> {
  try {
    const vb = `${PILOT_BOUNDS.minLng},${PILOT_BOUNDS.maxLat},${PILOT_BOUNDS.maxLng},${PILOT_BOUNDS.minLat}`;
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6` +
      `&viewbox=${vb}&bounded=1&accept-language=${lang}` +
      `&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "Accept-Language": lang },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data as Array<Record<string, string>>).map((d) => ({
      label: String(d.display_name).split(",").slice(0, 3).join(", "),
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));
  } catch {
    return [];
  }
}
