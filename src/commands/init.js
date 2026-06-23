import { resolve } from "node:path";
import { existsSync, writeFileSync } from "node:fs";
import { PvsError, EXIT } from "../core/errors.js";

const DEFAULT_CONFIG = {
  schemaVersion: 1,
  targets: [],
};

export async function init(options = {}) {
  const root = resolve(options.root || process.cwd());
  const configPath = resolve(root, "pvs.config.json");

  if (existsSync(configPath)) {
    throw new PvsError(
      "pvs.config.json already exists",
      "PVS_CONFIG_INVALID",
      { exitCode: EXIT.CONFIG_ERROR }
    );
  }

  const content = JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n";
  writeFileSync(configPath, content, "utf8");

  return { created: configPath };
}
