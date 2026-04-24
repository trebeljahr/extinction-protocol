// Strip dangling external-texture references from Crystal1.glb in the
// landmark dirs. The GLBs ship with `images:[{uri:"Textures/colormap.png"}]`
// pointing at a sidecar PNG that was never committed — three.js silently
// renders untextured at runtime, but gltf-transform refuses to load the
// asset at all (so conv3d / gltfjsx skip it).
//
// We rewrite the GLB JSON chunk to:
//   - drop the broken image/texture entries
//   - clear baseColorTexture / normalTexture / etc references on materials
// The mesh, vertex colors, and material color factors are preserved, so
// runtime output is identical to today (untextured crystal).
//
// Usage: node scripts/fix-crystal-textures.mjs [--dry-run]
import { readFile, writeFile } from "node:fs/promises";

const dryRun = process.argv.includes("--dry-run");
const targets = [
  "public/models/landmarks/wasteland/Crystal1.glb",
  "public/models/landmarks/snow/Crystal1.glb",
];

const MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

const padTo4 = (buf, padByte) => {
  const pad = (4 - (buf.length % 4)) % 4;
  if (pad === 0) return buf;
  const out = Buffer.alloc(buf.length + pad, padByte);
  buf.copy(out);
  return out;
};

for (const path of targets) {
  const buf = await readFile(path);
  if (buf.readUInt32LE(0) !== MAGIC) {
    console.error(`${path}: not a GLB`);
    continue;
  }
  const version = buf.readUInt32LE(4);
  const totalLen = buf.readUInt32LE(8);
  const jsonChunkLen = buf.readUInt32LE(12);
  const jsonChunkType = buf.readUInt32LE(16);
  if (jsonChunkType !== JSON_CHUNK) {
    console.error(`${path}: first chunk is not JSON`);
    continue;
  }

  const jsonBytes = buf.slice(20, 20 + jsonChunkLen);
  const json = JSON.parse(jsonBytes.toString("utf8"));

  const externalImageIdx = new Set();
  const images = json.images ?? [];
  for (let i = 0; i < images.length; i++) {
    const im = images[i];
    if (typeof im.uri === "string" && !im.uri.startsWith("data:")) externalImageIdx.add(i);
  }

  if (externalImageIdx.size === 0) {
    console.log(`${path}: no external textures, skipping`);
    continue;
  }

  // Map texture index -> drop? Drop if the underlying image is external.
  const droppedTex = new Set();
  const textures = json.textures ?? [];
  for (let i = 0; i < textures.length; i++) {
    if (externalImageIdx.has(textures[i].source)) droppedTex.add(i);
  }

  const stripTexRef = (mat, key) => {
    if (mat[key]?.index !== undefined && droppedTex.has(mat[key].index)) {
      delete mat[key];
    }
  };

  for (const mat of json.materials ?? []) {
    if (mat.pbrMetallicRoughness) {
      stripTexRef(mat.pbrMetallicRoughness, "baseColorTexture");
      stripTexRef(mat.pbrMetallicRoughness, "metallicRoughnessTexture");
    }
    stripTexRef(mat, "normalTexture");
    stripTexRef(mat, "emissiveTexture");
    stripTexRef(mat, "occlusionTexture");
  }

  // Remove the dropped textures + images. Easier path: just clear external
  // images and any texture pointing at them — index-stability concerns are
  // moot because we've already removed every reference above.
  json.images = images.filter((_, i) => !externalImageIdx.has(i));
  json.textures = textures.filter((_, i) => !droppedTex.has(i));
  if (json.images.length === 0) delete json.images;
  if (json.textures.length === 0) delete json.textures;

  // After dropping textures we may have orphan samplers; harmless to keep.

  const newJsonStr = JSON.stringify(json);
  // GLB JSON chunk must be 4-byte aligned, padded with 0x20 (space).
  const newJsonBytes = padTo4(Buffer.from(newJsonStr, "utf8"), 0x20);

  // Recompose: 12-byte header + 8-byte JSON chunk header + JSON + (rest as-is).
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

  console.log(
    `${path}: ${buf.length} → ${out.length} bytes; dropped ${externalImageIdx.size} image(s), ${droppedTex.size} texture(s)`,
  );
  if (!dryRun) await writeFile(path, out);
}

console.log(dryRun ? "\nDry run — no files written." : "\nDone.");
