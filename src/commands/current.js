import { resolve } from "node:path";
import { readManifest } from "../core/manifest.js";
import { parseVersion } from "../core/semver.js";

export async function current(options = {}) {
  const root = resolve(options.root || process.cwd());
  const manifest = readManifest(root);
  const version = manifest.data.version || "0.0.0";
  const parsed = parseVersion(version);
  return { version, major: parsed.major, minor: parsed.minor, patch: parsed.patch };
}
