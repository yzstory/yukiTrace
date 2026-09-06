import "server-only";
import sharp from "sharp";
import exifr from "exifr";
import { db } from "@/lib/db";
import { auditedDb } from "@/lib/activity";
import { makeKey, putObject } from "@/lib/storage";
import { wgs84ToGcj02 } from "@/lib/geo";

const MAX_EDGE = 2400;

export type ProcessedImage = {
  data: Buffer;
  width: number;
  height: number;
  size: number;
  takenAt: Date | null;
  lat: number | null;
  lng: number | null;
};

/** 读 EXIF、自动旋转、压到 webp。解码失败抛错，由调用方决定怎么提示。 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
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
    /* 无 EXIF 很常见（截图、微信图） */
  }

  const resized = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  return { data: resized.data, width: resized.info.width, height: resized.info.height, size: resized.info.size, takenAt, lat, lng };
}

/** 有 GPS 时匹配 500m 内最近的站点 */
export async function matchStopByGps(tripId: string, lat: number, lng: number): Promise<string | null> {
  const stops = await db.stop.findMany({ where: { tripId }, select: { id: true, lat: true, lng: true } });
  let best: { id: string; d: number } | null = null;
  for (const s of stops) {
    const d = Math.hypot((s.lat - lat) * 111000, (s.lng - lng) * 111000 * Math.cos((lat * Math.PI) / 180));
    if (d < 500 && (!best || d < best.d)) best = { id: s.id, d };
  }
  return best?.id ?? null;
}

/** 处理并入库为旅程照片。返回 Photo 记录。 */
export async function storeTripPhoto(opts: {
  tripId: string;
  buffer: Buffer;
  uploaderId: string;
  stopId?: string | null;
  entryId?: string | null;
  caption?: string | null;
  firstMoment?: string | null;
  source?: "manual" | "ai";
}) {
  const db = auditedDb({ tripId: opts.tripId, userId: opts.uploaderId, source: opts.source });
  const img = await processImage(opts.buffer);
  const key = makeKey(opts.tripId, "webp");
  await putObject(key, img.data, "image/webp");

  let stopId = opts.stopId ?? null;
  if (!stopId && img.lat != null && img.lng != null) stopId = await matchStopByGps(opts.tripId, img.lat, img.lng);

  return db.photo.create({
    data: {
      tripId: opts.tripId,
      stopId,
      entryId: opts.entryId ?? null,
      uploaderId: opts.uploaderId,
      ossKey: key,
      width: img.width,
      height: img.height,
      sizeBytes: img.size,
      takenAt: img.takenAt,
      lat: img.lat,
      lng: img.lng,
      caption: opts.caption ?? null,
      firstMoment: opts.firstMoment ?? null,
    },
  });
}

/** 只存文件不建 Photo 记录（封面 / 票据） */
export async function storeImageOnly(tripId: string, buffer: Buffer): Promise<string> {
  const img = await processImage(buffer);
  const key = makeKey(tripId, "webp");
  await putObject(key, img.data, "image/webp");
  return key;
}
