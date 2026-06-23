import { resolve, relative } from "node:path";
import { readManifest } from "../core/manifest.js";
import { loadConfig } from "../core/config.js";
import { parseVersion } from "../core/semver.js";
import { buildVars } from "../core/template.js";
import { processTarget } from "../core/targets.js";
import { atomicWrite } from "../core/writer.js";
import { isGitRepo, getGitSha, getGitShaLong } from "../core/git.js";
import { PvsError, EXIT } from "../core/errors.js";

export async function sync(options = {}) {
  const root = resolve(options.root || process.cwd());
  const configPath = options.config || "pvs.config.json";
  const dryRun = options.dryRun === true;
  const noGit = options.noGit === true;

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
  const gitSha = !noGit && isGitRepo(root) ? getGitSha(root) : "";
  const gitShaLong = !noGit && isGitRepo(root) ? getGitShaLong(root) : "";
  const vars = buildVars(version, parsed, { gitSha, gitShaLong });

  const mutations = [];

  for (const target of config.targets) {
    const result = processTarget(target, vars, config);
    mutations.push({ filePath: result.filePath, content: result.content, label: target.file });
  }

  for (const m of mutations) {
    atomicWrite(m.filePath, m.content, dryRun);
  }

  return {
    version,
    changedFiles: mutations.map((m) => relative(root, m.filePath)),
  };
}
