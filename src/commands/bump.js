import { resolve, relative, isAbsolute } from "node:path";
import { readManifest, serializeManifest } from "../core/manifest.js";
import { readLockfiles, applyLockfileVersion, serializeLockfile } from "../core/lockfile.js";
import { loadConfig } from "../core/config.js";
import { parseVersion, incrementVersion, isReleaseType } from "../core/semver.js";
import { buildVars, applyTemplate } from "../core/template.js";
import { processTarget } from "../core/targets.js";
import { atomicWrite } from "../core/writer.js";
import { isGitRepo, getGitSha, getGitShaLong, isGitDirty, gitAdd, gitCommit, gitTag, getLastTag, getCommitsSince } from "../core/git.js";
import { parseConventionalCommit, resolveBumpType } from "../core/commits.js";
import { groupCommits, renderChangelogSection, prependChangelog } from "../core/changelog.js";
import { readFileSync, existsSync } from "node:fs";
import { PvsError, EXIT } from "../core/errors.js";

export async function bump(release, options = {}) {
  const root = resolve(options.root || process.cwd());
  const configPath = options.config || "pvs.config.json";
  const dryRun = options.dryRun === true;
  const noGit = options.noGit === true;
  const allowDirty = options.allowDirty === true;
  const noLockfile = options.noLockfile === true;
  const preid = options.preid || "";
  const doCommit = options.commit === true;
  const doTag = options.tag === true;
  const tagPrefix = options.tagPrefix || "v";
  const messageTemplate = options.message || "chore: release v$version";
  const doChangelog = options.changelog === true;
  const changelogFile = options.changelogFile || "CHANGELOG.md";

  if (doTag && !/^[a-zA-Z0-9._/-]*$/.test(tagPrefix)) {
    throw new PvsError(
      `Invalid --tag-prefix "${tagPrefix}". Allowed characters: letters, digits, '.', '_', '-', '/'.`,
      "PVS_CONFIG_INVALID",
      { exitCode: EXIT.CONFIG_ERROR }
    );
  }

  const changelogPath = resolve(root, changelogFile);
  if (doChangelog) {
    const changelogRel = relative(root, changelogPath);
    if (changelogRel.startsWith("..") || isAbsolute(changelogRel)) {
      throw new PvsError(
        `Unsafe path: "${changelogFile}" resolves outside project root`,
        "PVS_UNSAFE_PATH",
        { exitCode: EXIT.UNSAFE_PATH, file: changelogFile }
      );
    }
  }

  const config = loadConfig(root, configPath);
  const manifest = readManifest(root);
  const currentVersion = manifest.data.version;

  if (!currentVersion) {
    throw new PvsError(
      'package.json has no "version" field',
      "PVS_VERSION_INVALID",
      { exitCode: EXIT.SEMVER_ERROR }
    );
  }

  let parsedCommits = null;
  function commitsSinceLastTag() {
    if (parsedCommits) return parsedCommits;
    if (noGit || !isGitRepo(root)) {
      throw new PvsError(
        "git is required to resolve 'auto' release type or --changelog",
        "PVS_GIT_REQUIRED",
        { exitCode: EXIT.FS_ERROR }
      );
    }
    const lastTag = getLastTag(root, tagPrefix);
    const raw = getCommitsSince(root, lastTag);
    parsedCommits = raw.map((c) => parseConventionalCommit(c.hash, c.subject, c.body));
    return parsedCommits;
  }

  const resolvedRelease = release === "auto" ? resolveBumpType(commitsSinceLastTag()) : release;

  const newVersion = isReleaseType(resolvedRelease)
    ? incrementVersion(currentVersion, resolvedRelease, preid)
    : (parseVersion(resolvedRelease), resolvedRelease); // validate then use as-is

  // Git dirty check only when we'll be modifying git history
  if ((doCommit || doTag) && !noGit && !allowDirty && isGitRepo(root)) {
    if (isGitDirty(root)) {
      throw new PvsError(
        "Git working tree is dirty. Commit or stash changes first, or use --allow-dirty.",
        "PVS_GIT_DIRTY",
        { exitCode: EXIT.FS_ERROR }
      );
    }
  }

  const parsed = parseVersion(newVersion);
  const gitSha = !noGit && isGitRepo(root) ? getGitSha(root) : "";
  const gitShaLong = !noGit && isGitRepo(root) ? getGitShaLong(root) : "";
  const vars = buildVars(newVersion, parsed, { gitSha, gitShaLong });

  const mutations = [];

  // 1. package.json
  const newManifestData = { ...manifest.data, version: newVersion };
  mutations.push({
    filePath: manifest.filePath,
    content: serializeManifest(newManifestData, manifest.indent, manifest.trailingNewline),
    label: "package.json",
  });

  // 2. lockfiles
  if (!noLockfile) {
    for (const lf of readLockfiles(root)) {
      mutations.push({
        filePath: lf.filePath,
        content: serializeLockfile(applyLockfileVersion(lf, newVersion), lf.indent, lf.trailingNewline),
        label: lf.name,
      });
    }
  }

  // 3. configured targets
  for (const target of config.targets) {
    const result = processTarget(target, vars, config);
    mutations.push({ filePath: result.filePath, content: result.content, label: target.file });
  }

  // 4. changelog
  if (doChangelog) {
    const grouped = groupCommits(commitsSinceLastTag());
    if (grouped.breaking.length > 0 || grouped.sections.length > 0) {
      const existing = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : "";
      const section = renderChangelogSection(newVersion, vars.date, grouped);
      mutations.push({
        filePath: changelogPath,
        content: prependChangelog(existing, section),
        label: relative(root, changelogPath),
      });
    }
  }

  for (const m of mutations) {
    atomicWrite(m.filePath, m.content, dryRun);
  }

  if (!dryRun && (doCommit || doTag)) {
    const changedPaths = mutations.map((m) => m.filePath);
    const commitMsg = applyTemplate(messageTemplate, vars);
    if (doCommit) {
      gitAdd(root, changedPaths);
      gitCommit(root, commitMsg);
    }
    if (doTag) {
      gitTag(root, `${tagPrefix}${newVersion}`, `Release ${tagPrefix}${newVersion}`);
    }
  }

  return {
    oldVersion: currentVersion,
    newVersion,
    changedFiles: mutations.map((m) => relative(root, m.filePath)),
  };
}
