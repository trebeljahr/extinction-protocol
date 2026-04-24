// Copy each *-transformed.glb back over its source GLB iff the optimized
// version is actually smaller. Some Quaternius GLBs come pre-compressed
// and gltf-transform's re-encode produces a larger file — those would
// be regressions if blindly replaced.
//
// Usage: node scripts/replace-optimized-glbs.mjs [--dry-run]
import { readdir, stat, copyFile, open } from "node:fs/promises";
import { join, dirname } from "node:path";

const ROOT = "public/models";
const dryRun = process.argv.includes("--dry-run");

const walk = async (dir) => {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(p)));
    else if (ent.isFile() && ent.name.endsWith("-transformed.glb")) out.push(p);
  }
  return out;
};

const sourcePathFor = (transformed) => {
  // .../<dir>/_convert-3d-for-web/glb-for-web/<name>-transformed.glb
  // → .../<dir>/<name>.glb
  const optimizedDir = dirname(transformed);
  const grandparent = dirname(dirname(optimizedDir));
  const name = transformed.split("/").pop().replace(/-transformed\.glb$/, ".glb");
  return join(grandparent, name);
};

const transformed = await walk(ROOT);
let replaced = 0;
let skippedLarger = 0;
let skippedMissing = 0;
let bytesBefore = 0;
let bytesAfter = 0;

for (const t of transformed) {
  const src = sourcePathFor(t);
  let srcStat;
  try {
    srcStat = await stat(src);
  } catch {
    skippedMissing++;
    continue;
  }
  const tStat = await stat(t);
  // Sanity bound: refuse to overwrite a real GLB with something empty or
  // implausibly tiny. A failed conv3d run can leave a 0-byte stub behind.
  if (tStat.size < 256) {
    console.warn(`SKIP ${src}: optimized output suspiciously small (${tStat.size} bytes)`);
    skippedLarger++;
    continue;
  }
  if (tStat.size >= srcStat.size) {
    skippedLarger++;
    continue;
  }
  // Reject failed transforms before they brick runtime loads. A valid
  // binary glTF is at least a 12-byte header starting with "glTF".
  let valid = tStat.size >= 12;
  if (valid) {
    const fh = await open(t, "r");
    const buf = Buffer.alloc(4);
    await fh.read(buf, 0, 4, 0);
    await fh.close();
    valid = buf.toString("ascii") === "glTF";
  }
  if (!valid) {
    console.warn(`SKIP ${t} (invalid GLB — ${tStat.size} bytes, missing magic)`);
    skippedLarger++;
    continue;
  }
  bytesBefore += srcStat.size;
  bytesAfter += tStat.size;
  if (!dryRun) await copyFile(t, src);
  replaced++;
  console.log(`${dryRun ? "WOULD REPLACE" : "REPLACED"} ${src} (${srcStat.size} → ${tStat.size})`);
}

const saved = bytesBefore - bytesAfter;
console.log(`\n${replaced} replaced, ${skippedLarger} skipped (optimized was larger), ${skippedMissing} skipped (no source)`);
console.log(`Saved: ${(saved / 1024 / 1024).toFixed(2)} MB`);
