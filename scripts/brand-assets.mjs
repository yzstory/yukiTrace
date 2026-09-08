/** Size/format exports of the approved fourth concept; never redraw the lettering. */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(ROOT, "assets/brand/trace-handwritten-source.png");
const out = (path) => {
  const file = resolve(ROOT, path);
  mkdirSync(dirname(file), { recursive: true });
  return file;
};
// Trim only transparent margins. Preserve the selected image's pixels and alpha.
const wordmark = await sharp(source).trim({ threshold: 20 }).png().toBuffer();
await sharp(wordmark).png().toFile(out("public/brand/trace-logo.png"));
await sharp(wordmark).png().toFile(out("public/brand/trace-handwritten-v1.png"));
await sharp(wordmark).png().toFile(out("miniprogram/assets/trace-logo.png"));
async function icon(size, maskable = false) {
  const width = Math.round(size * (maskable ? 0.70 : 0.88));
  const foreground = await sharp(wordmark).resize({ width }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: "#FFF9F3" } })
    .composite([{ input: foreground, gravity: "centre" }]).png({ compressionLevel: 9 }).toBuffer();
}
for (const size of [180, 192, 512]) writeFileSync(out(`public/icons/icon-${size}.png`), await icon(size));
writeFileSync(out("public/icons/maskable-512.png"), await icon(512, true));
writeFileSync(out("src/app/icon.png"), await icon(512));
const sizes = [16, 32, 48, 256];
const images = await Promise.all(sizes.map((size) => icon(size)));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((img, i) => {
  const entry = 6 + i * 16;
  header.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], entry);
  header.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(img.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += img.length;
});
writeFileSync(out("src/app/favicon.ico"), Buffer.concat([header, ...images]));
console.log("Approved handwritten Trace logo and application icons exported.");
