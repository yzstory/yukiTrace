"use client";

import { listOps, listPhotos, removeOp, removePhoto, markFailure } from "./queue";
import type { SyncResult } from "./types";

/** 单次同步不重试超过这么多次的条目，避免坏数据卡住队列 */
const MAX_ATTEMPTS = 5;

let running = false;

export async function flushQueue(tripId?: string): Promise<SyncResult> {
  if (running || typeof navigator === "undefined" || !navigator.onLine) return { synced: 0, failed: 0, errors: [] };
  running = true;
  const result: SyncResult = { synced: 0, failed: 0, errors: [] };

  try {
    const ops = await listOps();
    for (const op of ops) {
      if ((tripId && op.tripId !== tripId) || op.attempts >= MAX_ATTEMPTS) continue;
      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: op.kind, tripId: op.tripId, fields: op.fields, clientId: op.id }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.ok) {
          await removeOp(op.id);
          result.synced++;
        } else {
          // 4xx 属于数据本身有问题，重试无意义，计入失败但保留以便用户查看
          await markFailure("ops", op.id, json.error ?? `HTTP ${res.status}`);
          result.failed++;
          if (json.error) result.errors.push(`${op.summary}：${json.error}`);
        }
      } catch (e) {
        await markFailure("ops", op.id, e instanceof Error ? e.message : "网络错误");
        result.failed++;
      }
    }

    const photos = await listPhotos();
    for (const p of photos) {
      if ((tripId && p.tripId !== tripId) || p.attempts >= MAX_ATTEMPTS) continue;
      try {
        const fd = new FormData();
        fd.set("tripId", p.tripId);
        if (p.stopId) fd.set("stopId", p.stopId);
        fd.append("files", new File([p.blob], p.filename, { type: p.blob.type || "image/jpeg" }));
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          await removePhoto(p.id);
          result.synced++;
        } else {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          await markFailure("photos", p.id, json.error ?? `HTTP ${res.status}`);
          result.failed++;
        }
      } catch (e) {
        await markFailure("photos", p.id, e instanceof Error ? e.message : "网络错误");
        result.failed++;
      }
    }
  } finally {
    running = false;
  }
  return result;
}
