import { createHash } from "node:crypto";

/**
 * Доступ к панели ДЧС.
 *
 * Один общий пароль — сознательное упрощение пилота: у нас нет ни отдела
 * кадров ведомства, ни SSO. Пароль задаётся переменной DASHBOARD_PASSWORD,
 * в куке лежит его хеш, а не он сам. Перед реальным договором с городом
 * это место меняется на нормальные учётные записи.
 */

export const DASH_COOKIE = "tasqyn_dash";

export function dashboardPassword(): string {
  return process.env.DASHBOARD_PASSWORD || "tasqyn";
}

export function dashboardToken(password = dashboardPassword()): string {
  return createHash("sha256").update(`tasqyn:${password}`).digest("hex");
}

export function isDashboardToken(token: string | undefined): boolean {
  return !!token && token === dashboardToken();
}
