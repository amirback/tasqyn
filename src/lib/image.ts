"use client";

/**
 * Сжатие фото прямо в браузере.
 *
 * Снимок с телефона — это 3–6 МБ, и по мобильной сети в паводок он не уйдёт.
 * Ужимаем до ~1280 px и JPEG q=0.72: этого хватает, чтобы сосед узнал
 * перекрёсток и увидел, докуда стоит вода, а вес падает до ~150 КБ.
 */

const MAX_SIDE = 1280;
const QUALITY = 0.72;
export const MAX_BYTES = 900 * 1024;

export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas недоступен");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  let quality = QUALITY;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  // Если исходник всё ещё тяжёлый — дожимаем, но не бесконечно.
  while (dataUrl.length * 0.75 > MAX_BYTES && quality > 0.35) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  return dataUrl;
}
