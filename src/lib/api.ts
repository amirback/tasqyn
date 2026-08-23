"use client";

import { deviceId } from "./device";
import type {
  HydroSnapshot,
  Report,
  ReportKind,
  RiskAssessment,
  Stats,
  WaterLevel,
} from "./types";

/** Клиент API. Устройство подставляется во все запросы автоматически. */

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-device": deviceId(),
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error ?? "generic") as Error & { code?: string };
    err.code = body?.error ?? "generic";
    throw err;
  }
  return body as T;
}

export interface ReportsResponse {
  reports: Report[];
  stats: Stats;
  hydro: HydroSnapshot | null;
  risk: RiskAssessment;
}

export function fetchReports(params: {
  period?: "6h" | "24h" | "7d" | "all";
  kinds?: ReportKind[];
}): Promise<ReportsResponse> {
  const q = new URLSearchParams();
  if (params.period) q.set("period", params.period);
  if (params.kinds?.length) q.set("kinds", params.kinds.join(","));
  return req<ReportsResponse>(`/api/reports?${q.toString()}`);
}

export interface NewReport {
  kind: ReportKind;
  level?: WaterLevel | null;
  lat: number;
  lng: number;
  address?: string | null;
  comment?: string | null;
  photo?: string | null; // data:image/jpeg;base64,...
}

export function submitReport(input: NewReport): Promise<{ report: Report }> {
  return req<{ report: Report }>("/api/reports", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function voteReport(
  id: string,
  value: 1 | -1,
): Promise<{ report: Report }> {
  return req<{ report: Report }>(`/api/reports/${id}/vote`, {
    method: "POST",
    body: JSON.stringify({ value }),
  });
}

export function resolveReport(id: string): Promise<{ report: Report }> {
  return req<{ report: Report }>(`/api/reports/${id}/resolve`, {
    method: "POST",
  });
}

export function deleteReport(id: string): Promise<{ ok: true }> {
  return req<{ ok: true }>(`/api/reports/${id}`, { method: "DELETE" });
}

export function fetchHydro(): Promise<HydroSnapshot> {
  return req<HydroSnapshot>("/api/hydro");
}
