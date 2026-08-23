import { NextResponse } from "next/server";
import { getHydro } from "@/lib/hydro";

export const revalidate = 1800;

export async function GET() {
  try {
    return NextResponse.json(await getHydro());
  } catch (e) {
    console.error("GET /api/hydro", e);
    return NextResponse.json({ error: "generic" }, { status: 502 });
  }
}
