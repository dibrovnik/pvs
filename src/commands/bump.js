import { resolve, relative } from "node:path";
import { readManifest, serializeManifest } from "../core/manifest.js";
import { readLockfiles, applyLockfileVersion, serializeLockfile } from "../core/lockfile.js";
import { loadConfig } from "../core/config.js";
import { parseVersion, incrementVersion, isReleaseType } from "../core/semver.js";
import { buildVars, applyTemplate } from "../core/template.js";
import { processTarget } from "../core/targets.js";
import { atomicWrite } from "../core/writer.js";
import { isGitRepo, getGitSha, getGitShaLong, isGitDirty, gitAdd, gitCommit, gitTag } from "../core/git.js";
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

  const newVersion = isReleaseType(release)
    ? incrementVersion(currentVersion, release, preid)
    : (parseVersion(release), release); // validate then use as-is

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
