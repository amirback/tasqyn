"use client";

/**
 * Анонимный идентификатор устройства.
 *
 * Регистрации в Tasqyn нет намеренно: в момент паводка человек не будет
 * придумывать пароль. Но нам всё же нужно понимать, где «своё» сообщение
 * и кто уже голосовал — для этого хватает случайного ключа в localStorage.
 * Ни телефона, ни почты, ни имени мы не собираем.
 */

const KEY = "tasqyn.device";

export function deviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Приватный режим: живём одну сессию.
    return "ephemeral-" + Math.random().toString(36).slice(2);
  }
}
