import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readLockfiles, applyLockfileVersion, serializeLockfile } from "../src/core/lockfile.js";

function makeTmp() {
  const dir = join(tmpdir(), `pvs-lockfile-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir);
  return dir;
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

const sampleLockfileV2 = {
  name: "my-app",
  version: "1.0.0",
  lockfileVersion: 2,
  requires: true,
  packages: {
    "": {
      name: "my-app",
      version: "1.0.0",
    },
  },
};

test("reads package-lock.json when present", () => {
  const dir = makeTmp();
  try {
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify(sampleLockfileV2, null, 2) + "\n");
    const lockfiles = readLockfiles(dir);
    assert.equal(lockfiles.length, 1);
    assert.equal(lockfiles[0].name, "package-lock.json");
    assert.equal(lockfiles[0].data.version, "1.0.0");
  } finally {
    cleanup(dir);
  }
});

test("returns empty array when no lockfile", () => {
  const dir = makeTmp();
  try {
    const lockfiles = readLockfiles(dir);
    assert.equal(lockfiles.length, 0);
  } finally {
    cleanup(dir);
  }
});

test("updates root version", () => {
  const lockfile = {
    data: { ...sampleLockfileV2 },
    name: "package-lock.json",
  };
  const updated = applyLockfileVersion(lockfile, "2.0.0");
  assert.equal(updated.version, "2.0.0");
});

test("updates packages[''].version", () => {
  const lockfile = {
    data: { ...sampleLockfileV2 },
    name: "package-lock.json",
  };
  const updated = applyLockfileVersion(lockfile, "2.0.0");
  assert.equal(updated.packages[""].version, "2.0.0");
});

test("serializes with trailing newline", () => {
  const data = { version: "1.0.0" };
  const result = serializeLockfile(data, 2, true);
  assert.ok(result.endsWith("\n"));
});

test("serializes without trailing newline", () => {
  const data = { version: "1.0.0" };
  const result = serializeLockfile(data, 2, false);
  assert.ok(!result.endsWith("\n"));
});

test("fails on invalid JSON in lockfile", () => {
  const dir = makeTmp();
  try {
    writeFileSync(join(dir, "package-lock.json"), "{ invalid json }");
    assert.throws(() => readLockfiles(dir), /PVS_LOCKFILE_INVALID|Invalid JSON/);
  } finally {
    cleanup(dir);
  }
});

test("reads npm-shrinkwrap.json when present", () => {
  const dir = makeTmp();
  try {
    writeFileSync(join(dir, "npm-shrinkwrap.json"), JSON.stringify(sampleLockfileV2, null, 2) + "\n");
    const lockfiles = readLockfiles(dir);
    assert.equal(lockfiles.length, 1);
    assert.equal(lockfiles[0].name, "npm-shrinkwrap.json");
  } finally {
    cleanup(dir);
  }
});
