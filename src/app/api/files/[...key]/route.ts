import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { getObject } from "@/lib/storage";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/files/[...key]">) {
  const { key } = await ctx.params;
  const objectKey = key.join("/");
  if (objectKey.includes("..")) return new NextResponse("bad key", { status: 400 });

  const session = await getSession();
  if (!session?.userId) {
    // 分享链接访问：token 必须对应该文件所属旅程
    const t = req.nextUrl.searchParams.get("t");
    const tripId = objectKey.match(/^trips\/([^/]+)\//)?.[1];
    const link = t && tripId ? await db.shareLink.findUnique({ where: { token: t }, select: { tripId: true, expiresAt: true } }) : null;
    if (!link || link.tripId !== tripId || (link.expiresAt && link.expiresAt < new Date())) return new NextResponse("unauthorized", { status: 401 });
  }

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
