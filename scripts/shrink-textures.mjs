// Shrink the embedded PNGs inside specific GLBs that gltfjsx's default
// pipeline didn't reduce. Targets Mushroom.glb / BushFlowers.glb where
// the bulk of the file is one or two large PNGs.
//
// Strategy: decode each embedded image with sharp, downscale up to 1024px
// on the longer side, re-encode as WebP at quality 80. WebP is supported
// by every browser the game targets.
//
// Usage: node scripts/shrink-textures.mjs <path-to-glb> [<path>...]
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

// Borrow sharp from conv3d's nested install — we don't want to add it
// as a project dep just for an offline asset script.
const require = createRequire(
  "/Users/rico/projects/conv3d/node_modules/.pnpm/sharp@0.33.5/node_modules/sharp/package.json",
);
const sharp = require("sharp");

const MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

const padTo4 = (buf, padByte) => {
  const pad = (4 - (buf.length % 4)) % 4;
  if (pad === 0) return buf;
  const out = Buffer.alloc(buf.length + pad, padByte);
  buf.copy(out);
  return out;
};

const MAX_DIM = 1024;
const QUALITY = 80;

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("Usage: node scripts/shrink-textures.mjs <glb> [...]");
  process.exit(1);
}

for (const path of targets) {
  const buf = await readFile(path);
  if (buf.readUInt32LE(0) !== MAGIC) {
    console.error(`${path}: not a GLB`);
    continue;
  }
  const version = buf.readUInt32LE(4);
  const jsonLen = buf.readUInt32LE(12);
  const jsonType = buf.readUInt32LE(16);
  if (jsonType !== JSON_CHUNK) continue;

  const jsonBytes = buf.slice(20, 20 + jsonLen);
  const json = JSON.parse(jsonBytes.toString("utf8"));

  const binStart = 20 + jsonLen;
  const binChunkLen = buf.readUInt32LE(binStart);
  const binChunkType = buf.readUInt32LE(binStart + 4);
  if (binChunkType !== BIN_CHUNK) {
    console.error(`${path}: missing BIN chunk`);
    continue;
  }
  const bin = buf.slice(binStart + 8, binStart + 8 + binChunkLen);

  // Pull image bytes out of the BIN, re-encode each one, then rebuild the
  // BIN buffer compact (image bytes first, then everything else preserved).
  const images = json.images ?? [];
  const bufferViews = json.bufferViews ?? [];

  const newSegments = [];
  let cursor = 0;
  let totalSavings = 0;

  // Map bufferView index → new {byteOffset, byteLength} or null if untouched.
  const newViewSpan = new Map();

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (img.bufferView === undefined) continue;
    const bv = bufferViews[img.bufferView];
    const slice = bin.slice(bv.byteOffset, bv.byteOffset + bv.byteLength);
    let pipeline = sharp(slice).rotate();
    const meta = await pipeline.metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (longest > MAX_DIM) {
      pipeline = pipeline.resize({
        width: meta.width >= meta.height ? MAX_DIM : null,
        height: meta.height > meta.width ? MAX_DIM : null,
        fit: "inside",
      });
    }
    const out = await pipeline.webp({ quality: QUALITY }).toBuffer();
    console.log(
      `  ${img.name ?? `image[${i}]`}: ${slice.length} → ${out.length} bytes (${meta.width}x${meta.height}, ${meta.format})`,
    );
    totalSavings += slice.length - out.length;
    img.mimeType = "image/webp";
    img.name = (img.name ?? `image_${i}`).replace(/\.\w+$/, "") + ".webp";
    newSegments.push({ bvIndex: img.bufferView, bytes: out, alignedOffset: cursor });
    cursor += out.length;
    // Pad to 4-byte boundary between images for safety.
    const pad = (4 - (cursor % 4)) % 4;
    if (pad > 0) cursor += pad;
  }

  // For every other buffer view, copy through after the rewritten images.
  const carryViews = [];
  for (let i = 0; i < bufferViews.length; i++) {
    const replaced = newSegments.find((s) => s.bvIndex === i);
    if (replaced) {
      newViewSpan.set(i, { byteOffset: replaced.alignedOffset, byteLength: replaced.bytes.length });
      continue;
    }
    const bv = bufferViews[i];
    carryViews.push({ index: i, bytes: bin.slice(bv.byteOffset, bv.byteOffset + bv.byteLength) });
  }

  let cursor2 = cursor;
  const carryParts = [];
  for (const c of carryViews) {
    const pad = (4 - (cursor2 % 4)) % 4;
    if (pad > 0) {
      carryParts.push(Buffer.alloc(pad));
      cursor2 += pad;
    }
    newViewSpan.set(c.index, { byteOffset: cursor2, byteLength: c.bytes.length });
    carryParts.push(c.bytes);
    cursor2 += c.bytes.length;
  }

  // Build new BIN.
  const parts = [];
  let acc = 0;
  for (const seg of newSegments) {
    parts.push(seg.bytes);
    acc += seg.bytes.length;
    const pad = (4 - (acc % 4)) % 4;
    if (pad > 0) {
      parts.push(Buffer.alloc(pad));
      acc += pad;
    }
  }
  for (const p of carryParts) {
    parts.push(p);
  }
  const newBin = Buffer.concat(parts);

  // Rewrite bufferViews with new offsets/lengths.
  for (let i = 0; i < bufferViews.length; i++) {
    const span = newViewSpan.get(i);
    if (!span) continue;
    bufferViews[i].byteOffset = span.byteOffset;
    bufferViews[i].byteLength = span.byteLength;
  }
  json.buffers[0].byteLength = newBin.length;

  const newJsonStr = JSON.stringify(json);
  const newJsonBytes = padTo4(Buffer.from(newJsonStr, "utf8"), 0x20);
  const paddedBin = padTo4(newBin, 0x00);

  const totalLen = 12 + 8 + newJsonBytes.length + 8 + paddedBin.length;
  const out = Buffer.alloc(totalLen);
  out.writeUInt32LE(MAGIC, 0);
  out.writeUInt32LE(version, 4);
  out.writeUInt32LE(totalLen, 8);
  out.writeUInt32LE(newJsonBytes.length, 12);
  out.writeUInt32LE(JSON_CHUNK, 16);
  newJsonBytes.copy(out, 20);
  out.writeUInt32LE(paddedBin.length, 20 + newJsonBytes.length);
  out.writeUInt32LE(BIN_CHUNK, 20 + newJsonBytes.length + 4);
  paddedBin.copy(out, 20 + newJsonBytes.length + 8);

  console.log(
    `${path}: ${buf.length} → ${out.length} bytes (saved ${totalSavings} bytes in textures)`,
  );
  await writeFile(path, out);
}
