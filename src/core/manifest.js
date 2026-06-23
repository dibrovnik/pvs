import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PvsError, EXIT } from "./errors.js";

export function readManifest(root) {
  const filePath = resolve(root, "package.json");

  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    throw new PvsError(
      `Cannot read package.json in: ${root}`,
      "PVS_PACKAGE_NOT_FOUND",
      { exitCode: EXIT.FS_ERROR, file: filePath }
    );
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new PvsError(
      `Invalid JSON in package.json`,
      "PVS_PACKAGE_NOT_FOUND",
      { exitCode: EXIT.FS_ERROR, file: filePath }
    );
  }

  return {
    data,
    raw,
    indent: detectIndent(raw),
    trailingNewline: raw.endsWith("\n"),
    filePath,
  };
}

export function serializeManifest(data, indent, trailingNewline) {
  const result = JSON.stringify(data, null, indent);
  return trailingNewline ? result + "\n" : result;
}

export function detectIndent(str) {
  const m = str.match(/^[ \t]*\{[\r\n]+([ \t]+)/m);
  if (!m) return 2;
  const sample = m[1];
  if (sample.startsWith("\t")) return "\t";
  return sample.length >= 4 ? 4 : 2;
}
