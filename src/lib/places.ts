"use client";

/**
 * «Мои адреса» живут только в браузере.
 *
 * Дом, работа, адрес родителей — это чувствительные данные, и на сервере
 * они нам не нужны: проверить, есть ли рядом вода, клиент умеет сам.
 * Побочный эффект приятный — фича работает без регистрации и без бэкенда.
 */

export interface Place {
  id: string;
  label: string;
  emoji: string;
  lat: number;
  lng: number;
  radiusM: number;
  createdAt: number;
  /** Когда мы в последний раз показывали уведомление по этому адресу. */
  notifiedAt?: number;
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

export function markNotified(id: string) {
  savePlaces(
    loadPlaces().map((p) =>
      p.id === id ? { ...p, notifiedAt: Date.now() } : p,
    ),
  );
}

/** Не чаще одного уведомления в 3 часа на адрес — иначе их выключат. */
export const NOTIFY_COOLDOWN_MS = 3 * 60 * 60 * 1000;
