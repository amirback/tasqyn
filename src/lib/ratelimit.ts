/**
 * Ограничитель частоты в памяти процесса.
 *
 * Задача скромная: не дать одному устройству залить карту сотней сообщений
 * за минуту. Против целенаправленной атаки этого мало, но на пилот в одном
 * городе достаточно, а внешних зависимостей не тянет.
 */

const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);

  // Изредка подчищаем, чтобы карта не росла бесконечно.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t > windowMs)) buckets.delete(k);
    }
  }
  return true;
}
