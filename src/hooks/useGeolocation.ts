"use client";

import { useCallback, useState } from "react";

export interface Position {
  lat: number;
  lng: number;
  accuracy: number;
}

/** Обёртка над Geolocation API: одно состояние вместо трёх колбэков. */
export function useGeolocation() {
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);

  const locate = useCallback((): Promise<Position | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDenied(true);
      return Promise.resolve(null);
    }
    setLoading(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setPosition(next);
          setDenied(false);
          setLoading(false);
          resolve(next);
        },
        () => {
          setDenied(true);
          setLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
      );
    });
  }, []);

  return { position, loading, denied, locate, setPosition };
}
