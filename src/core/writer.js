import { writeFileSync, renameSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { PvsError, EXIT } from "./errors.js";

export function atomicWrite(filePath, content, dryRun = false) {
  if (dryRun) return;

  const dir = dirname(filePath);
  const tmp = resolve(dir, `.pvs-${randomBytes(8).toString("hex")}.tmp`);

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(tmp, content, { encoding: "utf8", mode: 0o600 });
    renameSync(tmp, filePath);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      // ignore cleanup failure
    }
    throw new PvsError(
      `Failed to write ${filePath}: ${err.message}`,
      "PVS_WRITE_FAILED",
      { exitCode: EXIT.FS_ERROR, file: filePath }
    );
  }
}
