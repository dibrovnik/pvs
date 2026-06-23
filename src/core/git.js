import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { PvsError, EXIT } from "./errors.js";

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return {
    ok: r.status === 0,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
  };
}

export function isGitRepo(root) {
  return existsSync(resolve(root, ".git"));
}

export function getGitSha(root) {
  const r = git(["rev-parse", "--short", "HEAD"], root);
  return r.ok ? r.stdout : "";
}

export function getGitShaLong(root) {
  const r = git(["rev-parse", "HEAD"], root);
  return r.ok ? r.stdout : "";
}

export function isGitDirty(root) {
  const r = git(["status", "--porcelain"], root);
  return r.ok ? r.stdout.length > 0 : false;
}

export function gitAdd(root, files) {
  git(["add", "--", ...files], root);
}

export function gitCommit(root, message) {
  const r = git(["commit", "-m", message], root);
  if (!r.ok) {
    throw new PvsError(
      `git commit failed: ${r.stderr}`,
      "PVS_WRITE_FAILED",
      { exitCode: EXIT.FS_ERROR }
    );
  }
}

export function gitTag(root, name, message) {
  const args = message
    ? ["tag", "-a", name, "-m", message]
    : ["tag", name];
  const r = git(args, root);
  if (!r.ok) {
    throw new PvsError(
      `git tag failed: ${r.stderr}`,
      "PVS_WRITE_FAILED",
      { exitCode: EXIT.FS_ERROR }
    );
  }
}
