import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/ratelimit";
import { voteReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const dev = req.headers.get("x-device") ?? "";
    if (!dev) return NextResponse.json({ error: "no_device" }, { status: 400 });
    if (!rateLimit(`vote:${dev}`, 60, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const { id } = await params;
    const body = await req.json();
    const value = Number(body.value);
    if (value !== 1 && value !== -1) {
      return NextResponse.json({ error: "bad_vote" }, { status: 400 });
    }

    const report = await voteReport(id, dev, value as 1 | -1);
    if (!report) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ report });
  } catch (e) {
    console.error("POST vote", e);
    return NextResponse.json({ error: "generic" }, { status: 500 });
  }
}
