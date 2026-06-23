import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readManifest, serializeManifest, detectIndent } from "../src/core/manifest.js";

function makeTmp() {
  const dir = join(tmpdir(), `pvs-manifest-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir);
  return dir;
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

test("reads package.json version", () => {
  const dir = makeTmp();
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test", version: "1.2.3" }, null, 2) + "\n");
    const manifest = readManifest(dir);
    assert.equal(manifest.data.version, "1.2.3");
  } finally {
    cleanup(dir);
  }
});

test("detects trailing newline", () => {
  const dir = makeTmp();
  try {
    writeFileSync(join(dir, "package.json"), '{"version":"1.0.0"}\n');
    const manifest = readManifest(dir);
    assert.equal(manifest.trailingNewline, true);
  } finally {
    cleanup(dir);
  }
});

test("detects no trailing newline", () => {
  const dir = makeTmp();
  try {
    writeFileSync(join(dir, "package.json"), '{"version":"1.0.0"}');
    const manifest = readManifest(dir);
    assert.equal(manifest.trailingNewline, false);
  } finally {
    cleanup(dir);
  }
});

test("serializes with trailing newline preserved", () => {
  const dir = makeTmp();
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "1.0.0" }, null, 2) + "\n");
    const manifest = readManifest(dir);
    const out = serializeManifest({ version: "1.0.1" }, manifest.indent, manifest.trailingNewline);
    assert.ok(out.endsWith("\n"));
    assert.ok(JSON.parse(out).version === "1.0.1");
  } finally {
    cleanup(dir);
  }
});

test("throws on missing package.json", () => {
  const dir = makeTmp();
  try {
    assert.throws(() => readManifest(dir), { code: "PVS_PACKAGE_NOT_FOUND" });
  } finally {
    cleanup(dir);
  }
});

test("detectIndent: 2 spaces", () => {
  assert.equal(detectIndent('{\n  "a": 1\n}'), 2);
});

test("detectIndent: 4 spaces", () => {
  assert.equal(detectIndent('{\n    "a": 1\n}'), 4);
});

test("detectIndent: tab", () => {
  assert.equal(detectIndent('{\n\t"a": 1\n}'), "\t");
});
