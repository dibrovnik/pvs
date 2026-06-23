import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(__dirname, "../bin/pvs.js");

function makeTmp() {
  const dir = join(tmpdir(), `pvs-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir);
  return dir;
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function pvs(args, cwd) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: "utf8",
  });
  return {
    stdout: r.stdout || "",
    stderr: r.stderr || "",
    status: r.status,
  };
}

function writePackageJson(dir, version) {
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "test-pkg", version }, null, 2) + "\n"
  );
}

test("pvs current prints version", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.2.3");
    const r = pvs(["current"], dir);
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), "1.2.3");
  } finally {
    cleanup(dir);
  }
});

test("pvs current --json prints JSON", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.2.3");
    const r = pvs(["current", "--json"], dir);
    assert.equal(r.status, 0);
    const data = JSON.parse(r.stdout);
    assert.equal(data.version, "1.2.3");
    assert.equal(data.major, 1);
    assert.equal(data.minor, 2);
    assert.equal(data.patch, 3);
  } finally {
    cleanup(dir);
  }
});

test("pvs bump patch --dry-run does not write files", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.2.3");
    const r = pvs(["bump", "patch", "--dry-run"], dir);
    assert.equal(r.status, 0);
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    assert.equal(pkg.version, "1.2.3"); // unchanged
    assert.ok(r.stdout.includes("1.2.3 -> 1.2.4"));
  } finally {
    cleanup(dir);
  }
});

test("pvs bump patch writes new version", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.2.3");
    const r = pvs(["bump", "patch"], dir);
    assert.equal(r.status, 0);
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    assert.equal(pkg.version, "1.2.4");
  } finally {
    cleanup(dir);
  }
});

test("pvs bump patch --json returns structured output", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "2.0.0");
    const r = pvs(["bump", "patch", "--json"], dir);
    assert.equal(r.status, 0);
    const data = JSON.parse(r.stdout);
    assert.equal(data.ok, true);
    assert.equal(data.oldVersion, "2.0.0");
    assert.equal(data.newVersion, "2.0.1");
  } finally {
    cleanup(dir);
  }
});

test("pvs sync --json with no targets", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.0.0");
    writeFileSync(join(dir, "pvs.config.json"), JSON.stringify({ schemaVersion: 1, targets: [] }) + "\n");
    const r = pvs(["sync", "--json"], dir);
    assert.equal(r.status, 0);
    const data = JSON.parse(r.stdout);
    assert.equal(data.ok, true);
    assert.deepEqual(data.changedFiles, []);
  } finally {
    cleanup(dir);
  }
});

test("pvs check exits 0 when all in sync", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.0.0");
    writeFileSync(join(dir, "pvs.config.json"), JSON.stringify({ schemaVersion: 1, targets: [] }) + "\n");
    const r = pvs(["check"], dir);
    assert.equal(r.status, 0);
  } finally {
    cleanup(dir);
  }
});

test("pvs check exits 1 on mismatch", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.2.3");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/v.ts"), "// pvs:start v\nexport const V = \"1.0.0\";\n// pvs:end v\n");
    writeFileSync(
      join(dir, "pvs.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        targets: [{ file: "src/v.ts", type: "marker", id: "v", template: "export const V = \"$version\";" }],
      }) + "\n"
    );
    const r = pvs(["check"], dir);
    assert.equal(r.status, 1);
  } finally {
    cleanup(dir);
  }
});

test("pvs init creates pvs.config.json", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.0.0");
    const r = pvs(["init"], dir);
    assert.equal(r.status, 0);
    const config = JSON.parse(readFileSync(join(dir, "pvs.config.json"), "utf8"));
    assert.equal(config.schemaVersion, 1);
    assert.deepEqual(config.targets, []);
  } finally {
    cleanup(dir);
  }
});

test("pvs --version prints version string", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.0.0");
    const r = pvs(["--version"], dir);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.trim().length > 0);
  } finally {
    cleanup(dir);
  }
});

test("pvs unknown command exits with error", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.0.0");
    const r = pvs(["frobnicate"], dir);
    assert.notEqual(r.status, 0);
  } finally {
    cleanup(dir);
  }
});

test("pvs bump without release arg exits with error", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.0.0");
    const r = pvs(["bump"], dir);
    assert.notEqual(r.status, 0);
  } finally {
    cleanup(dir);
  }
});

test("exit code 5 on unsafe path config", () => {
  const dir = makeTmp();
  try {
    writePackageJson(dir, "1.0.0");
    writeFileSync(
      join(dir, "pvs.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        targets: [{ file: "../outside.txt", type: "generated", template: "x" }],
      }) + "\n"
    );
    const r = pvs(["bump", "patch"], dir);
    assert.equal(r.status, 5);
  } finally {
    cleanup(dir);
  }
});
