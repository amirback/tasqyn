import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Фото лежат прямо в базе как base64.
 *
 * Для пилота это осознанный выбор: не нужно ни S3, ни диска, ни ключей —
 * бэкап базы забирает и снимки. Размер ограничен сжатием на клиенте.
 * Когда город даст объём, слой уедет в объектное хранилище — интерфейс
 * этого роута менять не придётся.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const c = await db();
  const res = await c.execute({
    sql: `SELECT mime, data FROM photos WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0];
  if (!row) return new NextResponse("not found", { status: 404 });

  const buf = Buffer.from(String(row.data), "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": String(row.mime),
      "content-length": String(buf.length),
      // Фото неизменяемо: id генерируется один раз вместе с сообщением.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
