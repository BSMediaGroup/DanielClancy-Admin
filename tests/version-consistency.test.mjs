import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);

async function readRepoFile(path) {
  return readFile(new URL(path, repoRoot), "utf8");
}

test("admin release metadata is aligned to v1.0", async () => {
  const packageJson = JSON.parse(await readRepoFile("package.json"));
  const bumpNotes = await readRepoFile("BUMP_NOTES.md");
  const releaseNotes = await readRepoFile("RELEASE_NOTES_v1.0.md");
  const readme = await readRepoFile("README.md");
  const index = await readRepoFile("index.html");

  assert.equal(Object.hasOwn(packageJson, "version"), false);
  assert.match(bumpNotes, /^# CURRENT VER= v1\.0 \/ PENDING VER= v1\.0\.1/m);
  assert.match(readme, /Current release: `v1\.0`/);
  assert.match(releaseNotes, /^# DanielClancy-Admin v1\.0/m);
  assert.match(index, />v1\.0</);
});

test("admin visible shell does not expose stale pre-release labels", async () => {
  const index = await readRepoFile("index.html");

  assert.doesNotMatch(index, /v0\.1\.2-beta|0\.1\.2-beta|pre-release/i);
  assert.doesNotMatch(index, /\b(alpha|beta)\b/i);
});
