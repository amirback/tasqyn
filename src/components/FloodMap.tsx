"use client";

import maplibregl, { type Map as MLMap, type Marker } from "maplibre-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/i18n";
import { IconMap, IconPin } from "./icons";
import { URALSK } from "@/lib/geo";
import {
  KIND_COLOR,
  KIND_EMOJI,
  LEVEL_COLOR,
  LEVEL_EMOJI,
  type Report,
} from "@/lib/types";

/**
 * Подложка — OpenFreeMap (векторные тайлы OpenStreetMap).
 * Без ключа, без счёта, без лимита запросов: для пилота, который должен
 * пережить пиковый день паводка, это важнее красивых спутниковых снимков.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

interface Props {
  reports: Report[];
  selectedId?: string | null;
  onSelect?: (report: Report | null) => void;
  /** Режим выбора точки: карта двигается под неподвижным перекрестием. */
  pickMode?: boolean;
  onPickMove?: (lat: number, lng: number) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  showHeat?: boolean;
  userPosition?: { lat: number; lng: number; accuracy: number } | null;
  /**
   * Задавайте размер (высоту и ширину), но не position: корень уже `relative`,
   * а второй класс позиционирования схлопнет карте высоту.
   */
  className?: string;
  /** Точки наблюдения из «моих адресов» — рисуем кругом радиуса. */
  watchAreas?: { lat: number; lng: number; radiusM: number; label: string }[];
  /** Чем заменить карту, если устройство её не тянет. */
  fallback?: ReactNode;
}

/**
 * Векторная карта требует WebGL, а он есть не везде: на бюджетных Android
 * и в урезанных браузерах контекст может не создаться. Молча падать нельзя —
 * человеку в паводок нужны данные, пусть даже списком.
 */
function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

function toGeoJSON(reports: Report[]) {
  return {
    type: "FeatureCollection" as const,
    features: reports.map((r) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        kind: r.kind,
        level: r.level ?? 0,
        weight: r.kind === "water" ? (r.level ?? 1) : 2,
      },
    })),
  };
}

/** Круг радиусом в метрах — GeoJSON-полигон из 64 точек. */
function circlePolygon(lat: number, lng: number, radiusM: number) {
  const points: [number, number][] = [];
  const latR = radiusM / 111320;
  const lngR = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    points.push([lng + lngR * Math.cos(a), lat + latR * Math.sin(a)]);
  }
  return points;
}

export function FloodMap({
  reports,
  selectedId,
  onSelect,
  pickMode = false,
  onPickMove,
  center,
  zoom,
  showHeat = true,
  userPosition,
  className = "",
  watchAreas,
  fallback,
}: Props) {
  const { t } = useI18n();
  const [broken, setBroken] = useState(false);
  /**
   * Готовность держим в состоянии, а не только в ref: карта грузит стиль
   * дольше, чем API отдаёт сообщения, и без перерисовки на `load` слои
   * получили бы пустой массив из старого замыкания.
   */
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const userMarkerRef = useRef<Marker | null>(null);
  const readyRef = useRef(false);
  const onPickMoveRef = useRef(onPickMove);
  const onSelectRef = useRef(onSelect);

  onPickMoveRef.current = onPickMove;
  onSelectRef.current = onSelect;

  /* ── Инициализация ─────────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!webglAvailable()) {
      setBroken(true);
      return;
    }

    let map: MLMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [center?.lng ?? URALSK.lng, center?.lat ?? URALSK.lat],
        zoom: zoom ?? URALSK.zoom,
        attributionControl: { compact: true },
        maxZoom: 18,
        minZoom: 8,
      });
    } catch {
      setBroken(true);
      return;
    }
    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    map.on("click", () => onSelectRef.current?.(null));

    /**
     * Слои вешаем на style.load, а не на load: событие load ждёт ещё и первого
     * кадра, и на слабом GPU может не прийти вовсе. HTML-метки от стиля не
     * зависят вообще — они добавляются сразу, поэтому даже «сломанный» стиль
     * оставляет пользователя с точками на экране.
     */
    const setupLayers = () => {
      if (!mapRef.current || map.getSource("reports")) return;

      map.addSource("reports", { type: "geojson", data: toGeoJSON([]) });


      // Тепловое пятно — «где вообще плохо», читается с высоты птичьего полёта.
      map.addLayer({
        id: "reports-heat",
        type: "heatmap",
        source: "reports",
        maxzoom: 16,
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["get", "weight"],
            0,
            0.35,
            4,
            1,
          ],
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            0.8,
            16,
            2.4,
          ],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(14,165,233,0)",
            0.2,
            "rgba(125,211,252,0.5)",
            0.45,
            "rgba(56,189,248,0.65)",
            0.7,
            "rgba(2,132,199,0.75)",
            1,
            "rgba(12,74,110,0.85)",
          ],
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            18,
            16,
            56,
          ],
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            13,
            0.75,
            16,
            0.25,
          ],
        },
      });

      map.addSource("watch", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "watch-fill",
        type: "fill",
        source: "watch",
        paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "watch-line",
        type: "line",
        source: "watch",
        paint: {
          "line-color": "#0284c7",
          "line-width": 1.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.6,
        },
      });

      readyRef.current = true;
      // Перерисовка прогонит эффекты ниже уже с актуальными данными.
      setReady(true);
    };

    if (map.isStyleLoaded()) setupLayers();
    else map.on("style.load", setupLayers);

    const markers = markersRef.current;
    return () => {
      markers.forEach((m) => m.remove());
      markers.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      readyRef.current = false;
      setReady(false);
      map.remove();
      mapRef.current = null;
    };
    // Карта создаётся один раз; параметры применяются отдельными эффектами.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Режим выбора точки ────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickMode) return;
    const emit = () => {
      const c = map.getCenter();
      onPickMoveRef.current?.(c.lat, c.lng);
    };
    map.on("moveend", emit);
    emit();
    return () => {
      map.off("moveend", emit);
    };
  }, [pickMode]);

  /* ── Маркеры ───────────────────────────────────────────── */
  const syncMarkers = () => {
    const map = mapRef.current;
    if (!map) return;

    // Слой мог ещё не появиться — метки от этого не зависят.
    if (readyRef.current) {
      const src = map.getSource("reports") as
        | maplibregl.GeoJSONSource
        | undefined;
      src?.setData(toGeoJSON(reports));
    }

    const seen = new Set<string>();

    for (const r of reports) {
      seen.add(r.id);
      const existing = markersRef.current.get(r.id);
      if (existing) {
        existing.setLngLat([r.lng, r.lat]);
        const el = existing.getElement();
        el.dataset.selected = String(selectedId === r.id);
        el.style.zIndex = selectedId === r.id ? "40" : "10";
        continue;
      }

      const color =
        r.kind === "water" && r.level
          ? LEVEL_COLOR[r.level]
          : KIND_COLOR[r.kind];
      const emoji =
        r.kind === "water" && r.level ? LEVEL_EMOJI[r.level] : KIND_EMOJI[r.kind];

      const wrap = document.createElement("div");
      wrap.className = "pin-wrap";
      wrap.style.color = color;

      // Пульсирующее кольцо — только там, где действительно срочно.
      const urgent =
        r.kind === "help" || (r.kind === "water" && (r.level ?? 0) >= 3);
      if (urgent && r.status !== "resolved") {
        const ring = document.createElement("div");
        ring.className = "pin-ring";
        wrap.appendChild(ring);
      }

      const pin = document.createElement("div");
      pin.className = "pin";
      pin.style.background = color;
      pin.style.opacity = r.status === "resolved" ? "0.45" : "1";
      const span = document.createElement("span");
      span.textContent = emoji;
      pin.appendChild(span);
      wrap.appendChild(pin);

      wrap.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current?.(r);
      });

      const marker = new maplibregl.Marker({ element: wrap, anchor: "center" })
        .setLngLat([r.lng, r.lat])
        .addTo(map);
      markersRef.current.set(r.id, marker);
    }

    for (const [id, marker] of markersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
  };

  useEffect(() => {
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, selectedId, ready]);

  /* ── Тепловая карта вкл/выкл ───────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.getLayer("reports-heat")) return;
    map.setLayoutProperty(
      "reports-heat",
      "visibility",
      showHeat ? "visible" : "none",
    );
  }, [showHeat, ready]);

  /* ── Зоны наблюдения ───────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("watch") as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: (watchAreas ?? []).map((w) => ({
        type: "Feature",
        properties: { label: w.label },
        geometry: {
          type: "Polygon",
          coordinates: [circlePolygon(w.lat, w.lng, w.radiusM)],
        },
      })),
    });
  }, [watchAreas, ready]);

  /* ── Метка пользователя ────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userPosition) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:20px;height:20px;border-radius:50%;background:#0ea5e9;" +
        "border:3px solid #fff;box-shadow:0 0 0 6px rgba(14,165,233,0.22)," +
        "0 6px 16px -4px rgba(7,26,43,0.5)";
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userPosition.lng, userPosition.lat])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userPosition.lng, userPosition.lat]);
    }
  }, [userPosition]);

  /* ── Внешнее управление камерой ────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.easeTo({
      center: [center.lng, center.lat],
      zoom: zoom ?? map.getZoom(),
      duration: 900,
    });
  }, [center, zoom]);

  if (broken) {
    return (
      <div
        className={`relative grid place-items-center bg-water-50 p-6 ${className}`}
      >
        {fallback ?? (
          <div className="max-w-xs text-center">
            <IconMap className="mx-auto mb-2 h-8 w-8 text-water-500" />
            <div className="text-sm font-extrabold">{t.map.noWebgl}</div>
            <p className="lead mt-1 text-xs">{t.map.noWebglHint}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="h-full w-full" />
      {pickMode && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="-translate-y-4">
            <IconPin className="animate-bob h-10 w-10 text-water-600 drop-shadow-lg" />
            <div className="mx-auto h-2 w-2 rounded-full bg-water-600/40 blur-[1px]" />
          </div>
        </div>
      )}
    </div>
  );
}
