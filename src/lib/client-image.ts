"use client";

import imageCompression from "browser-image-compression";

/**
 * 上传前的客户端预处理：
 * 1. iPhone 默认拍出 HEIC/HEIF，Alpine 上的 sharp 不带 libheif，必须先转 JPEG；
 * 2. 顺带压缩，把手机上传流量降一个量级（服务端仍会二次处理成 webp）。
 * EXIF 会被保留（browser-image-compression preserveExif），拍摄时间与 GPS 不丢。
 */

const MAX_EDGE = 2400;
const MAX_MB = 3;

export function isProbablyHeic(file: File) {
  const t = file.type.toLowerCase();
  if (t === "image/heic" || t === "image/heif") return true;
  // iOS 有时不给 MIME，只能看扩展名
  return !t && /\.(heic|heif)$/i.test(file.name);
}

async function heicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import("heic-to");
  const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg", lastModified: file.lastModified });
}

export async function prepareImage(file: File): Promise<File> {
  let input = file;
  if (isProbablyHeic(file)) {
    try {
      input = await heicToJpeg(file);
    } catch {
      // 转换失败就原样交给服务端，由服务端返回可读错误
      return file;
    }
  }
  // 已经很小的图片不必再压
  if (input.size <= MAX_MB * 1024 * 1024 && !isProbablyHeic(file)) return input;
  try {
    return await imageCompression(input, {
      maxSizeMB: MAX_MB,
      maxWidthOrHeight: MAX_EDGE,
      useWebWorker: true,
      preserveExif: true,
      fileType: "image/jpeg",
      initialQuality: 0.9,
    });
  } catch {
    return input;
  }
}

/** 聊天附件：图片以 data URL 放进消息体，压得更狠一些（1600px / ≤1MB） */
export async function prepareChatImage(file: File): Promise<File> {
  const base = await prepareImage(file);
  try {
    const out = await imageCompression(base, { maxSizeMB: 1, maxWidthOrHeight: 1600, useWebWorker: true, preserveExif: true, fileType: "image/jpeg", initialQuality: 0.85 });
    // 压缩库在部分浏览器返回的是 Blob，统一包成 File
    return out instanceof File ? out : new File([out], base.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg", lastModified: base.lastModified });
  } catch {
    return base;
  }
}

export async function prepareImages(files: File[], onProgress?: (done: number, total: number) => void): Promise<File[]> {
  const out: File[] = [];
  for (const [i, f] of files.entries()) {
    out.push(await prepareImage(f));
    onProgress?.(i + 1, files.length);
  }
  return out;
}

/** 供 input accept 使用 */
export const IMAGE_ACCEPT = "image/*,.heic,.heif";
