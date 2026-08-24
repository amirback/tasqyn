"use client";

/**
 * «Мои адреса»: список мест, за которыми следит человек.
 *
 * Дом, работа, адрес родителей — данные чувствительные, поэтому список живёт
 * в браузере: названия и точные координаты на сервер не уходят.
 *
 * Исключение одно и осознанное. Чтобы push дошёл при закрытом браузере,
 * серверу нужны координаты — туда отправляются только они, округлённые до
 * ~100 м (см. lib/pushClient.ts). Названия «дом» и «мама» остаются здесь.
 */

export interface Place {
  id: string;
  label: string;
  emoji: string;
  lat: number;
  lng: number;
  radiusM: number;
  createdAt: number;
}

const KEY = "tasqyn.places";

export const PLACE_EMOJI = ["🏠", "🏢", "👵", "🏫", "🏥", "🚗", "🏪", "⛺"];

export function loadPlaces(): Place[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Place[]) : [];
  } catch {
    return [];
  }
}

export function savePlaces(places: Place[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(places));
  } catch {
    /* приватный режим */
  }
}

export function addPlace(place: Omit<Place, "id" | "createdAt">): Place[] {
  const next = [
    ...loadPlaces(),
    {
      ...place,
      id: Math.random().toString(36).slice(2, 10),
      createdAt: Date.now(),
    },
  ];
  savePlaces(next);
  return next;
}

export function removePlace(id: string): Place[] {
  const next = loadPlaces().filter((p) => p.id !== id);
  savePlaces(next);
  return next;
}


