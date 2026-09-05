import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { getObject } from "@/lib/storage";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/files/[...key]">) {
  const session = await getSession();
  if (!session?.userId) return new NextResponse("unauthorized", { status: 401 });
  const { key } = await ctx.params;
  const objectKey = key.join("/");
  if (objectKey.includes("..")) return new NextResponse("bad key", { status: 400 });

  const buf = await getObject(objectKey);
  if (!buf) return new NextResponse("not found", { status: 404 });

  const w = Number(req.nextUrl.searchParams.get("w"));
  let out: Buffer = buf;
  if (w && w > 0 && w <= 2400) {
    out = await sharp(buf).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  }
  return new NextResponse(new Uint8Array(out), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
