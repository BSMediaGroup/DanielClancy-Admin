import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.resolve(process.env.DANIELCLANCY_PUBLIC_ROOT || path.join(repoRoot, "..", "DanielClancy"));
const checkMode = process.argv.includes("--check") || process.argv.includes("--dry-run");
const written = [];
const warnings = [];

const DATA_FILES = [
  "source-audit-report.json",
  "admin-companies-baseline.json",
  "admin-platforms-baseline.json",
  "admin-positions-baseline.json",
  "public-projects-baseline.json"
];

async function main() {
  if (!existsSync(publicRoot)) {
    throw new Error(`DanielClancy public repo not found: ${publicRoot}`);
  }

  const catalog = await buildAssetCatalog();
  await preserveGeneratedAtIfOnlyTimestampChanged(path.join(repoRoot, "assets", "data", "public-asset-catalog.json"), catalog, "metadata");
  await writeJsonIfChanged(path.join(repoRoot, "assets", "data", "public-asset-catalog.json"), catalog);
  for (const name of DATA_FILES) {
    await assertJsonFile(path.join(repoRoot, "assets", "data", name));
  }
  await copyPreviewAssets();

  const counts = catalog.metadata.counts;
  const baselines = await baselineCounts();
  console.log(JSON.stringify({
    ok: true,
    mode: checkMode ? "check" : "write",
    publicRoot,
    counts: {
      assets: counts.total,
      thumbnails: counts.thumbnail,
      portfolioImages: counts.portfolio_image,
      docs: counts.document_pdf,
      projects: baselines.projects,
      companies: baselines.companies,
      platforms: baselines.platforms,
      positions: baselines.positions
    },
    warnings,
    filesWritten: written
  }, null, 2));

  if (checkMode && written.length) {
    process.exitCode = 1;
  }
}

async function buildAssetCatalog() {
  const scans = [
    { dir: "public/media/portfolio/thumbs", type: "thumbnail" },
    { dir: "public/media/portfolio", type: "portfolio_image" },
    { dir: "public/docs", type: "document_pdf" }
  ];
  const entries = [];
  for (const scan of scans) {
    const absDir = path.join(publicRoot, scan.dir);
    if (!existsSync(absDir)) {
      warnings.push(`missing_scan_dir:${scan.dir}`);
      continue;
    }
    const files = await listFiles(absDir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (scan.type === "document_pdf" && ext !== ".pdf") continue;
      if (scan.type !== "document_pdf" && ![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) continue;
      const relToPublic = slash(path.relative(path.join(publicRoot, "public"), file));
      if (scan.type === "portfolio_image" && relToPublic.startsWith("media/portfolio/thumbs/")) continue;
      const fileStat = await stat(file);
      const filename = path.basename(file);
      entries.push({
        id: `${scan.type}:${slug(filename)}`,
        type: scan.type,
        filename,
        relativePath: `/${relToPublic}`,
        sourceDir: scan.dir,
        sourceRepo: "DanielClancy",
        adminPreviewPath: `/${relToPublic}`,
        extension: ext,
        mime: mimeFor(ext),
        sizeBytes: fileStat.size,
        sourceModifiedAt: fileStat.mtime.toISOString(),
        updatedAt: fileStat.mtime.toISOString(),
        label: labelFromFilename(filename)
      });
    }
  }
  entries.sort((left, right) => left.type.localeCompare(right.type) || left.filename.localeCompare(right.filename));
  const counts = {
    total: entries.length,
    thumbnail: entries.filter((entry) => entry.type === "thumbnail").length,
    portfolio_image: entries.filter((entry) => entry.type === "portfolio_image").length,
    document_pdf: entries.filter((entry) => entry.type === "document_pdf").length,
    other_document: 0
  };
  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      sourceRepo: "DanielClancy",
      adminRepo: "DanielClancy-Admin",
      sourceDirectories: scans.map((scan) => scan.dir),
      note: "Catalog reflects public preview files copied into DanielClancy-Admin at matching public paths.",
      counts
    },
    entries
  };
}

async function copyPreviewAssets() {
  for (const rel of ["public/media/portfolio/thumbs", "public/media/portfolio", "public/docs"]) {
    const from = path.join(publicRoot, rel);
    const to = path.join(repoRoot, rel);
    if (!existsSync(from)) continue;
    const files = await listFiles(from);
    for (const file of files) {
      const target = path.join(to, path.relative(from, file));
      await mkdir(path.dirname(target), { recursive: true });
      if (!checkMode) await copyFile(file, target);
    }
  }
}

async function assertJsonFile(file) {
  const raw = await readFile(file, "utf8");
  JSON.parse(raw);
}

async function writeJsonIfChanged(file, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const current = existsSync(file) ? await readFile(file, "utf8") : "";
  if (current === next) return;
  written.push(path.relative(repoRoot, file));
  if (!checkMode) await writeFile(file, next);
}

async function preserveGeneratedAtIfOnlyTimestampChanged(file, next, metaKey) {
  if (!existsSync(file)) return;
  try {
    const current = JSON.parse(await readFile(file, "utf8"));
    const currentGeneratedAt = current?.[metaKey]?.generatedAt;
    if (!currentGeneratedAt || !next?.[metaKey]) return;
    const candidate = {
      ...next,
      [metaKey]: {
        ...next[metaKey],
        generatedAt: currentGeneratedAt
      }
    };
    if (JSON.stringify({ ...current, [metaKey]: { ...current[metaKey], generatedAt: currentGeneratedAt } }) === JSON.stringify(candidate)) {
      next[metaKey].generatedAt = currentGeneratedAt;
    }
  } catch {
    // If the current file is unreadable, the normal write/check path reports the diff.
  }
}

async function baselineCounts() {
  const [projects, companies, platforms, positions] = await Promise.all([
    readJson("public-projects-baseline.json"),
    readJson("admin-companies-baseline.json"),
    readJson("admin-platforms-baseline.json"),
    readJson("admin-positions-baseline.json")
  ]);
  return {
    projects: projects.projects?.length || 0,
    companies: companies.companies?.length || 0,
    platforms: platforms.platforms?.length || 0,
    positions: positions.positions?.length || 0
  };
}

async function readJson(name) {
  return JSON.parse(await readFile(path.join(repoRoot, "assets", "data", name), "utf8"));
}

async function listFiles(dir) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function slash(value) {
  return value.replace(/\\/g, "/");
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}

function labelFromFilename(value) {
  return path.basename(value, path.extname(value)).replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function mimeFor(ext) {
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf"
  }[ext] || "application/octet-stream";
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
