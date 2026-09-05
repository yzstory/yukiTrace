import { NextResponse, type NextRequest } from "next/server";
import sharp, { type Metadata, type OutputInfo } from "sharp";
import exifr from "exifr";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { makeKey, putObject } from "@/lib/storage";
import { revalidatePath } from "next/cache";
import { wgs84ToGcj02 } from "@/lib/geo";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_EDGE = 2400;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const tripId = String(form.get("tripId") ?? "");
  const stopId = form.get("stopId") ? String(form.get("stopId")) : null;
  const entryId = form.get("entryId") ? String(form.get("entryId")) : null;
  const purpose = String(form.get("purpose") ?? "photo"); // photo | cover | receipt
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!tripId || files.length === 0) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const trip = await db.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: session.userId }, { members: { some: { userId: session.userId, role: { in: ["OWNER", "EDITOR"] } } } }] },
    select: { id: true },
  });
  if (!trip) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const results = [];
  const failures: string[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      failures.push(`${file.name} 超过 25MB`);
      continue;
    }
    const input = Buffer.from(await file.arrayBuffer());

    // EXIF：拍摄时间与 GPS
    let takenAt: Date | null = null;
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const exif = await exifr.parse(input, { pick: ["DateTimeOriginal", "CreateDate"], gps: true });
      const dt = exif?.DateTimeOriginal ?? exif?.CreateDate;
      if (dt instanceof Date && !isNaN(dt.getTime())) takenAt = dt;
      if (typeof exif?.latitude === "number" && typeof exif?.longitude === "number") {
        const g = wgs84ToGcj02({ lat: exif.latitude, lng: exif.longitude });
        lat = g.lat;
        lng = g.lng;
      }
    } catch {
      /* ignore */
    }

    // 压缩到 webp，最长边 2400，自动旋转
    let meta: Metadata;
    let resized: { data: Buffer; info: OutputInfo };
    try {
      const img = sharp(input, { failOn: "none" }).rotate();
      meta = await img.metadata();
      resized = await img
        .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      failures.push(`${file.name} 无法解码${/heic|heif/i.test(file.type + file.name) ? "（HEIC 需在手机端转换后重试）" : ""}`);
      continue;
    }

    const key = makeKey(tripId, "webp");
    await putObject(key, resized.data, "image/webp");

    if (purpose === "cover") {
      await db.trip.update({ where: { id: tripId }, data: { coverKey: key } });
      results.push({ key, purpose });
      continue;
    }
    if (purpose === "receipt") {
      results.push({ key, purpose });
      continue;
    }

    // 若照片带 GPS 且未指定站点，尝试自动匹配 500m 内最近站点
    let matchedStopId = stopId;
    if (!matchedStopId && lat != null && lng != null) {
      const stops = await db.stop.findMany({ where: { tripId }, select: { id: true, lat: true, lng: true } });
      let best: { id: string; d: number } | null = null;
      for (const s of stops) {
        const d = Math.hypot((s.lat - lat) * 111000, (s.lng - lng) * 111000 * Math.cos((lat * Math.PI) / 180));
        if (d < 500 && (!best || d < best.d)) best = { id: s.id, d };
      }
      matchedStopId = best?.id ?? null;
    }

    const photo = await db.photo.create({
      data: {
        tripId,
        stopId: matchedStopId,
        entryId,
        uploaderId: session.userId,
        ossKey: key,
        width: resized.info.width,
        height: resized.info.height,
        sizeBytes: resized.info.size,
        takenAt,
        lat,
        lng,
      },
    });
    results.push({ id: photo.id, key, stopId: matchedStopId, takenAt, width: meta.width, height: meta.height });
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
  if (results.length === 0 && failures.length > 0) return NextResponse.json({ error: failures.join("；") }, { status: 415 });
  return NextResponse.json({ results, failures });
}
