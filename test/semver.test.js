import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVersion, incrementVersion } from "../src/core/semver.js";

test("parses 1.2.3", () => {
  const v = parseVersion("1.2.3");
  assert.deepEqual(v, { major: 1, minor: 2, patch: 3, prerelease: "", build: "" });
});

test("parses 0.0.0", () => {
  const v = parseVersion("0.0.0");
  assert.equal(v.major, 0);
  assert.equal(v.minor, 0);
  assert.equal(v.patch, 0);
});

test("parses prerelease", () => {
  const v = parseVersion("1.2.3-rc.1");
  assert.equal(v.prerelease, "rc.1");
});

test("parses build metadata", () => {
  const v = parseVersion("1.2.3+build.5");
  assert.equal(v.build, "build.5");
});

test("rejects 1.2 (missing patch)", () => {
  assert.throws(() => parseVersion("1.2"), /PVS_VERSION_INVALID|Invalid SemVer/);
});

test("rejects 1 (missing minor and patch)", () => {
  assert.throws(() => parseVersion("1"), /PVS_VERSION_INVALID|Invalid SemVer/);
});

test("rejects 01.2.3 (leading zero in major)", () => {
  assert.throws(() => parseVersion("01.2.3"), /PVS_VERSION_INVALID|Invalid SemVer/);
});

test("rejects 1.02.3 (leading zero in minor)", () => {
  assert.throws(() => parseVersion("1.02.3"), /PVS_VERSION_INVALID|Invalid SemVer/);
});

test("rejects 1.2.03 (leading zero in patch)", () => {
  assert.throws(() => parseVersion("1.2.03"), /PVS_VERSION_INVALID|Invalid SemVer/);
});

test("rejects v1.2.3 (v prefix not allowed in version field)", () => {
  assert.throws(() => parseVersion("v1.2.3"), /PVS_VERSION_INVALID|Invalid SemVer/);
});

test("rejects empty string", () => {
  assert.throws(() => parseVersion(""), /PVS_VERSION_INVALID|Invalid SemVer/);
});

test("patch increment", () => {
  assert.equal(incrementVersion("1.2.3", "patch"), "1.2.4");
});

test("minor increment resets patch", () => {
  assert.equal(incrementVersion("1.2.3", "minor"), "1.3.0");
});

test("major increment resets minor and patch", () => {
  assert.equal(incrementVersion("1.2.3", "major"), "2.0.0");
});

test("prepatch with preid", () => {
  assert.equal(incrementVersion("1.2.3", "prepatch", "rc"), "1.2.4-rc.0");
});

test("preminor with preid", () => {
  assert.equal(incrementVersion("1.2.3", "preminor", "rc"), "1.3.0-rc.0");
});

test("premajor with preid", () => {
  assert.equal(incrementVersion("1.2.3", "premajor", "rc"), "2.0.0-rc.0");
});

test("prerelease increments numeric identifier", () => {
  assert.equal(incrementVersion("1.2.3-rc.0", "prerelease"), "1.2.3-rc.1");
});

test("prerelease on stable bumps patch and adds pre", () => {
  assert.equal(incrementVersion("1.2.3", "prerelease"), "1.2.4-0");
});

test("explicit version string passes through", () => {
  assert.equal(incrementVersion("1.2.3", "2.0.0"), "2.0.0");
});

test("explicit invalid version throws", () => {
  assert.throws(() => incrementVersion("1.2.3", "notaversion"), /PVS_VERSION_INVALID|Invalid SemVer/);
});
