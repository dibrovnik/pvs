import { readFileSync, existsSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { readManifest } from "../core/manifest.js";
import { isGitRepo, getLastTag, getCommitsSince } from "../core/git.js";
import { parseConventionalCommit } from "../core/commits.js";
import { groupCommits, renderChangelogSection, prependChangelog } from "../core/changelog.js";
import { atomicWrite } from "../core/writer.js";
import { PvsError, EXIT } from "../core/errors.js";

export async function changelog(options = {}) {
  const root = resolve(options.root || process.cwd());
  const dryRun = options.dryRun === true;
  const file = options.changelogFile || "CHANGELOG.md";
  const tagPrefix = options.tagPrefix || "v";

  const filePath = resolve(root, file);
  const rel = relative(root, filePath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new PvsError(
      `Unsafe path: "${file}" resolves outside project root`,
      "PVS_UNSAFE_PATH",
      { exitCode: EXIT.UNSAFE_PATH, file }
    );
  }

  if (!isGitRepo(root)) {
    throw new PvsError(
      "Not a git repository. Changelog generation requires git history.",
      "PVS_GIT_REQUIRED",
      { exitCode: EXIT.FS_ERROR }
    );
  }

  const version = options.version || readManifest(root).data.version;
  const from = options.from || getLastTag(root, tagPrefix) || "";
  const rawCommits = getCommitsSince(root, from);
  const commits = rawCommits.map((c) => parseConventionalCommit(c.hash, c.subject, c.body));
  const grouped = groupCommits(commits);

  if (grouped.breaking.length === 0 && grouped.sections.length === 0) {
    throw new PvsError(
      "No feat/fix/perf/revert commits found for changelog since " + (from || "repo start"),
      "PVS_NO_COMMITS",
      { exitCode: EXIT.FS_ERROR }
    );
  }

  const date = (options.now instanceof Date ? options.now : new Date()).toISOString().slice(0, 10);
  const section = renderChangelogSection(version, date, grouped);
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const content = prependChangelog(existing, section);

  atomicWrite(filePath, content, dryRun);

  return {
    file: relative(root, filePath),
    version,
    from: from || "(repo start)",
    commitCount: rawCommits.length,
  };
}
