import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { storeTripPhoto, storeImageOnly } from "@/lib/photos";
import { requestUserId } from "@/lib/api/auth";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { analyzePhotos, autoPickCover } from "@/lib/ai/photo";
import { reindexTrip } from "@/lib/ai/memory";
import { aiConfigured } from "@/lib/ai/model";
import { rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const userId = await requestUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limited = rateLimit(`upload:${userId}`, LIMITS.upload.limit, LIMITS.upload.windowMs);
  if (!limited.ok) return tooManyRequests(limited, "上传太频繁");

  const form = await req.formData();
  const tripId = String(form.get("tripId") ?? "");
  const stopId = form.get("stopId") ? String(form.get("stopId")) : null;
  const entryId = form.get("entryId") ? String(form.get("entryId")) : null;
  const purpose = String(form.get("purpose") ?? "photo"); // photo | cover | receipt
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!tripId || files.length === 0) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const trip = await db.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: userId }, { members: { some: { userId: userId, role: { in: ["OWNER", "EDITOR"] } } } }] },
    select: { id: true },
  });
  if (!trip) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const results: Array<{ id?: string; key: string; stopId?: string | null; takenAt?: Date | null; purpose?: string }> = [];
  const failures: string[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) {
      failures.push(`${file.name} 超过 25MB`);
      continue;
    }
    const input = Buffer.from(await file.arrayBuffer());
    try {
      if (purpose === "cover") {
        const key = await storeImageOnly(tripId, input);
        await db.trip.update({ where: { id: tripId }, data: { coverKey: key } });
        results.push({ key, purpose });
        continue;
      }
      if (purpose === "receipt") {
        results.push({ key: await storeImageOnly(tripId, input), purpose });
        continue;
      }
      const photo = await storeTripPhoto({ tripId, buffer: input, uploaderId: userId, stopId, entryId });
      results.push({ id: photo.id, key: photo.ossKey, stopId: photo.stopId, takenAt: photo.takenAt });
    } catch {
      failures.push(`${file.name} 无法解码${/heic|heif/i.test(file.type + file.name) ? "（HEIC 需在手机端转换后重试）" : ""}`);
    }
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
  log.info("upload.done", { userId: userId, tripId, ok: results.length, failed: failures.length });

  // 响应先返回，照片理解放到后台跑
  const newIds = results.map((r) => r.id).filter((id): id is string => Boolean(id));
  if (aiConfigured() && newIds.length > 0) {
    after(async () => {
      try {
        await analyzePhotos(newIds);
        await autoPickCover(tripId);
        await reindexTrip(tripId);
        revalidatePath(`/trips/${tripId}`);
        revalidatePath("/trips");
      } catch (err) {
        log.error("photo.analyze batch failed", { tripId, err });
      }
    });
  }
  if (results.length === 0 && failures.length > 0) return NextResponse.json({ error: failures.join("；") }, { status: 415 });
  return NextResponse.json({ results, failures });
}
