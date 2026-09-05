import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { searchPoi, amapConfigured } from "@/lib/amap";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const city = req.nextUrl.searchParams.get("city") ?? undefined;
  if (!q) return NextResponse.json({ results: [], configured: amapConfigured() });
  const results = await searchPoi(q, city);
  return NextResponse.json({ results, configured: amapConfigured() });
}
