import { NextResponse, type NextRequest } from "next/server";
import { deleteReport, getReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const report = await getReport(id, req.headers.get("x-device") ?? undefined);
  if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ report });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const dev = req.headers.get("x-device") ?? "";
  if (!dev) return NextResponse.json({ error: "no_device" }, { status: 400 });
  const { id } = await params;
  const ok = await deleteReport(id, dev);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
