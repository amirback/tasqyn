import { NextResponse, type NextRequest } from "next/server";
import { resolveReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const dev = req.headers.get("x-device") ?? "";
    if (!dev) return NextResponse.json({ error: "no_device" }, { status: 400 });
    const { id } = await params;
    const report = await resolveReport(id, dev);
    if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ report });
  } catch (e) {
    console.error("POST resolve", e);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
