"use client";

import { openDB, type IDBPDatabase } from "idb";
import type { QueuedOp, QueuedPhoto } from "./types";

const DB_NAME = "yukitrace-offline";
const VERSION = 1;
const OPS = "ops";
const PHOTOS = "photos";

let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  if (typeof indexedDB === "undefined") return null;
  dbp ??= openDB(DB_NAME, VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(OPS)) d.createObjectStore(OPS, { keyPath: "id" });
      if (!d.objectStoreNames.contains(PHOTOS)) d.createObjectStore(PHOTOS, { keyPath: "id" });
    },
  });
  return dbp;
}

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function enqueueOp(op: Omit<QueuedOp, "id" | "createdAt" | "attempts">): Promise<QueuedOp> {
  const full: QueuedOp = { ...op, id: newId(), createdAt: Date.now(), attempts: 0 };
  const d = await db();
  if (d) await d.put(OPS, full);
  notify();
  return full;
}

export async function enqueuePhoto(p: Omit<QueuedPhoto, "id" | "createdAt" | "attempts">): Promise<void> {
  const d = await db();
  if (d) await d.put(PHOTOS, { ...p, id: newId(), createdAt: Date.now(), attempts: 0 } satisfies QueuedPhoto);
  notify();
}

export async function listOps(): Promise<QueuedOp[]> {
  const d = await db();
  if (!d) return [];
  return ((await d.getAll(OPS)) as QueuedOp[]).sort((a, b) => a.createdAt - b.createdAt);
}

export async function listPhotos(): Promise<QueuedPhoto[]> {
  const d = await db();
  if (!d) return [];
  return ((await d.getAll(PHOTOS)) as QueuedPhoto[]).sort((a, b) => a.createdAt - b.createdAt);
}

export async function pendingCount(): Promise<number> {
  const d = await db();
  if (!d) return 0;
  return (await d.count(OPS)) + (await d.count(PHOTOS));
}

export async function removeOp(id: string) {
  const d = await db();
  if (d) await d.delete(OPS, id);
  notify();
}

export async function removePhoto(id: string) {
  const d = await db();
  if (d) await d.delete(PHOTOS, id);
  notify();
}

export async function markFailure(store: "ops" | "photos", id: string, error: string) {
  const d = await db();
  if (!d) return;
  const rec = await d.get(store, id);
  if (!rec) return;
  await d.put(store, { ...rec, attempts: (rec.attempts ?? 0) + 1, lastError: error });
  notify();
}

export async function clearAll() {
  const d = await db();
  if (!d) return;
  await d.clear(OPS);
  await d.clear(PHOTOS);
  notify();
}

/** 队列变化广播，供角标订阅 */
const EVENT = "yt:queue-changed";
function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
}
export function onQueueChange(fn: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
export const QUEUE_EVENT = EVENT;
