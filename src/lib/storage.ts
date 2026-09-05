import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import OSS from "ali-oss";

/**
 * 存储抽象：配置了 OSS 就用 OSS，否则落到本地 ./uploads（开发环境）。
 * ossKey 统一形如 `trips/{tripId}/{yyyyMM}/{random}.jpg`
 */

const LOCAL_DIR = path.join(process.cwd(), "uploads");

export function storageMode(): "oss" | "local" {
  return process.env.OSS_BUCKET && process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET ? "oss" : "local";
}

function ossClient() {
  return new OSS({
    region: process.env.OSS_REGION!,
    bucket: process.env.OSS_BUCKET!,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
    secure: true,
  });
}

export function makeKey(tripId: string, ext: string) {
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `trips/${tripId}/${ym}/${crypto.randomBytes(8).toString("hex")}.${ext.replace(/^\./, "")}`;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if (storageMode() === "oss") {
    await ossClient().put(key, body, { headers: { "Content-Type": contentType } });
    return;
  }
  const full = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

export async function getObject(key: string): Promise<Buffer | null> {
  if (storageMode() === "oss") {
    const res = await ossClient().get(key);
    return res.content as Buffer;
  }
  try {
    return await fs.readFile(path.join(LOCAL_DIR, key));
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (storageMode() === "oss") {
    await ossClient().delete(key).catch(() => {});
    return;
  }
  await fs.rm(path.join(LOCAL_DIR, key), { force: true });
}

/**
 * 图片访问 URL。
 * - OSS：公共读 bucket 直接拼 URL，并用图片处理参数生成缩略图；
 *        私有 bucket 则签名 URL。
 * - local：走 /api/files/[...key] 路由，宽度参数由路由用 sharp 处理。
 */
export function imageUrl(key: string, opts: { w?: number; q?: number } = {}): string {
  if (storageMode() === "oss") {
    const base =
      process.env.OSS_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
      `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com`;
    const process_ = opts.w ? `?x-oss-process=image/resize,w_${opts.w}/quality,q_${opts.q ?? 80}/format,webp` : "";
    return `${base}/${key}${process_}`;
  }
  const q = new URLSearchParams();
  if (opts.w) q.set("w", String(opts.w));
  const qs = q.toString();
  return `/api/files/${key}${qs ? `?${qs}` : ""}`;
}
