// KayKit "Space Base Bits" optimized GLBs ship a 1×1 placeholder image
// (the real 1024² atlas was externalized during optimization), so three.js
// renders every piece flat-coloured. UVs are intact, so we re-embed the
// real spacebits_texture.png into each GLB's JSON image as a data URI —
// making the GLBs self-contained and correctly textured, exactly like the
// rest of the project's models. Same GLB-JSON-rewrite approach as
// scripts/fix-crystal-textures.mjs.
//
// Usage: node scripts/embed-outpost-textures.mjs [--dry-run]
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dryRun = process.argv.includes("--dry-run");
const DIR = "public/models/outpost";
const TEXTURE = join(DIR, "spacebits_texture.png");

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

const padTo4 = (buf, padByte) => {
  const pad = (4 - (buf.length % 4)) % 4;
  if (pad === 0) return buf;
  const out = Buffer.alloc(buf.length + pad, padByte);
  buf.copy(out);
  return out;
};

const pngBytes = await readFile(TEXTURE);
const dataUri = `data:image/png;base64,${pngBytes.toString("base64")}`;

const files = (await readdir(DIR)).filter((f) => f.endsWith(".glb"));
let changed = 0;

for (const name of files) {
  const path = join(DIR, name);
  const buf = await readFile(path);
  if (buf.readUInt32LE(0) !== MAGIC) {
    console.error(`${name}: not a GLB`);
    continue;
  }
  const version = buf.readUInt32LE(4);
  const jsonChunkLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== JSON_CHUNK) {
    console.error(`${name}: first chunk is not JSON`);
    continue;
  }

  const json = JSON.parse(buf.slice(20, 20 + jsonChunkLen).toString("utf8"));
  const images = json.images ?? [];
  if (images.length === 0) {
    console.log(`${name}: no images, skipping`);
    continue;
  }
  // Replace every embedded image with the real atlas. Each piece references
  // a single shared atlas, so this is correct for all of them.
  let touched = false;
  for (const im of images) {
    if (im.uri !== dataUri) {
      im.uri = dataUri;
      delete im.mimeType; // uri data already encodes the mime
      touched = true;
    }
  }
  if (!touched) {
    console.log(`${name}: already embedded, skipping`);
    continue;
  }

  const newJsonBytes = padTo4(Buffer.from(JSON.stringify(json), "utf8"), 0x20);
  const restStart = 20 + jsonChunkLen;
  const rest = buf.slice(restStart);
  const newTotalLen = 12 + 8 + newJsonBytes.length + rest.length;

  const out = Buffer.alloc(newTotalLen);
  out.writeUInt32LE(MAGIC, 0);
  out.writeUInt32LE(version, 4);
  out.writeUInt32LE(newTotalLen, 8);
  out.writeUInt32LE(newJsonBytes.length, 12);
  out.writeUInt32LE(JSON_CHUNK, 16);
  newJsonBytes.copy(out, 20);
  rest.copy(out, 20 + newJsonBytes.length);

  console.log(`${name}: ${buf.length} → ${out.length} bytes`);
  if (!dryRun) await writeFile(path, out);
  changed++;
}

console.log(dryRun ? `\nDry run — ${changed} would change.` : `\nDone — ${changed} embedded.`);
