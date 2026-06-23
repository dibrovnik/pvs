import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { readManifest } from "../core/manifest.js";
import { loadConfig } from "../core/config.js";
import { parseVersion } from "../core/semver.js";
import { buildVars } from "../core/template.js";
import { processTarget } from "../core/targets.js";
import { PvsError, EXIT } from "../core/errors.js";

export async function check(options = {}) {
  const root = resolve(options.root || process.cwd());
  const configPath = options.config || "pvs.config.json";

  const config = loadConfig(root, configPath);
  const manifest = readManifest(root);
  const version = manifest.data.version;

  if (!version) {
    throw new PvsError(
      'package.json has no "version" field',
      "PVS_VERSION_INVALID",
      { exitCode: EXIT.SEMVER_ERROR }
    );
  }

  const parsed = parseVersion(version);
  const vars = buildVars(version, parsed, {});

  const mismatches = [];

  for (const target of config.targets) {
    try {
      const result = processTarget(target, vars, config);

      let currentContent;
      try {
        currentContent = existsSync(result.filePath)
          ? readFileSync(result.filePath, "utf8")
          : null;
      } catch {
        currentContent = null;
      }

      if (currentContent === null) {
        mismatches.push({ file: target.file, reason: "file does not exist" });
      } else if (currentContent !== result.content) {
        mismatches.push({ file: target.file, reason: "out of sync" });
      }
    } catch (err) {
      if (err instanceof PvsError) {
        mismatches.push({ file: target.file, reason: err.message });
      } else {
        throw err;
      }
    }
  }

  return { version, mismatches };
}
