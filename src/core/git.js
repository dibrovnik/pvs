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

export function getLastTag(root, prefix = "") {
  const args = prefix
    ? ["describe", "--tags", "--abbrev=0", "--match", `${prefix}*`]
    : ["describe", "--tags", "--abbrev=0"];
  const r = git(args, root);
  return r.ok ? r.stdout : "";
}

const RECORD_SEP = "\x1e";
const FIELD_SEP = "\x1f";

export function getCommitsSince(root, ref) {
  const range = ref ? `${ref}..HEAD` : "HEAD";
  const format = `%H${FIELD_SEP}%s${FIELD_SEP}%b${RECORD_SEP}`;
  const r = git(["log", range, `--format=${format}`], root);
  if (!r.ok) return [];

  return r.stdout
    .split(RECORD_SEP)
    .map((rec) => rec.replace(/^\n/, ""))
    .filter((rec) => rec.trim().length > 0)
    .map((rec) => {
      const [hash, subject, body] = rec.split(FIELD_SEP);
      return { hash, subject: subject || "", body: (body || "").trim() };
    });
}
