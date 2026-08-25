import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(repoRoot, "dist");

if (path.dirname(outputDir) !== repoRoot || path.basename(outputDir) !== "dist") {
  throw new Error(`Refusing to rebuild an unexpected output directory: ${outputDir}`);
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const file of ["index.html", "favicon.ico", "_redirects"]) {
  await copyFile(path.join(repoRoot, file), path.join(outputDir, file));
}

await copyTree(path.join(repoRoot, "assets"), path.join(outputDir, "assets"), (source) => (
  path.extname(source).toLowerCase() !== ".zip"
));

for (const entry of await readdir(path.join(repoRoot, "public"), { withFileTypes: true })) {
  await copyTree(path.join(repoRoot, "public", entry.name), path.join(outputDir, entry.name));
}

const requiredOutputs = [
  "index.html",
  "_redirects",
  "assets/css/admin.css",
  "assets/js/admin-app.js",
  "assets/js/admin-auth.js",
  "assets/logos/logo-danielclancy.svg",
  "media/portfolio",
  "docs"
];

for (const requiredOutput of requiredOutputs) {
  await stat(path.join(outputDir, requiredOutput));
}

const forbiddenOutputs = [".git", ".env", "functions", "tests", "tools"];
for (const forbiddenOutput of forbiddenOutputs) {
  try {
    await stat(path.join(outputDir, forbiddenOutput));
    throw new Error(`Non-deployable path leaked into dist: ${forbiddenOutput}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const summary = await summarize(outputDir);
console.log(JSON.stringify({ ok: true, outputDir, ...summary }, null, 2));

async function copyTree(source, target, filter = () => true) {
  if (!filter(source)) return;
  const sourceStat = await stat(source);
  if (sourceStat.isDirectory()) {
    await mkdir(target, { recursive: true });
    for (const entry of await readdir(source)) {
      await copyTree(path.join(source, entry), path.join(target, entry), filter);
    }
    return;
  }
  if (sourceStat.isFile()) await copyFile(source, target);
}

async function summarize(directory) {
  let files = 0;
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await summarize(entryPath);
      files += nested.files;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += (await stat(entryPath)).size;
    }
  }
  return { files, bytes };
}
