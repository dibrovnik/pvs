import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PvsError, EXIT } from "./errors.js";
import { detectIndent } from "./manifest.js";

const LOCKFILE_NAMES = ["package-lock.json", "npm-shrinkwrap.json"];

export function readLockfiles(root) {
  const result = [];

  for (const name of LOCKFILE_NAMES) {
    const filePath = resolve(root, name);
    if (!existsSync(filePath)) continue;

    let raw;
    try {
      raw = readFileSync(filePath, "utf8");
    } catch {
      throw new PvsError(
        `Cannot read ${name}`,
        "PVS_LOCKFILE_INVALID",
        { exitCode: EXIT.FS_ERROR, file: filePath }
      );
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new PvsError(
        `Invalid JSON in ${name}`,
        "PVS_LOCKFILE_INVALID",
        { exitCode: EXIT.FS_ERROR, file: filePath }
      );
    }

    result.push({
      name,
      filePath,
      data,
      indent: detectIndent(raw),
      trailingNewline: raw.endsWith("\n"),
    });
  }

  return result;
}

export function applyLockfileVersion(lockfile, newVersion) {
  const data = { ...lockfile.data };

  if ("version" in data) {
    data.version = newVersion;
  }

  if (data.packages && data.packages[""] && "version" in data.packages[""]) {
    data.packages = {
      ...data.packages,
      "": { ...data.packages[""], version: newVersion },
    };
  }

  return data;
}

export function serializeLockfile(data, indent, trailingNewline) {
  const result = JSON.stringify(data, null, indent);
  return trailingNewline ? result + "\n" : result;
}
