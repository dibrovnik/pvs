import { readFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { PvsError, EXIT } from "./errors.js";

const SUPPORTED_TYPES = new Set(["marker", "replace", "json", "generated"]);

export function loadConfig(root, configPath = "pvs.config.json") {
  const absPath = resolve(root, configPath);

  // Reject config paths that escape the project root
  const configRel = relative(resolve(root), absPath);
  if (configRel.startsWith("..") || isAbsolute(configRel)) {
    throw new PvsError(
      `Config path "${configPath}" resolves outside project root`,
      "PVS_UNSAFE_PATH",
      { exitCode: EXIT.UNSAFE_PATH }
    );
  }

  let raw;
  try {
    raw = readFileSync(absPath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      return { targets: [], _loaded: false };
    }
    throw new PvsError(
      `Cannot read config: ${absPath}`,
      "PVS_CONFIG_NOT_FOUND",
      { exitCode: EXIT.CONFIG_ERROR }
    );
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new PvsError(
      `Invalid JSON in config: ${absPath}`,
      "PVS_CONFIG_INVALID",
      { exitCode: EXIT.CONFIG_ERROR }
    );
  }

  return validateConfig(config, root);
}

function validateConfig(config, root) {
  if (config.schemaVersion !== undefined && config.schemaVersion !== 1) {
    throw new PvsError(
      `Unsupported schemaVersion: ${config.schemaVersion}. Expected: 1`,
      "PVS_CONFIG_INVALID",
      { exitCode: EXIT.CONFIG_ERROR }
    );
  }

  const targets = Array.isArray(config.targets) ? config.targets : [];
  const allowSymlinks = config.allowSymlinks === true;
  const maxFileSizeBytes =
    config.limits?.maxFileSizeBytes ?? 2 * 1024 * 1024;

  const resolvedTargets = targets.map((target, i) => {
    if (!target.file) {
      throw new PvsError(
        `Target[${i}] missing "file" field`,
        "PVS_CONFIG_INVALID",
        { exitCode: EXIT.CONFIG_ERROR }
      );
    }
    if (!target.type || !SUPPORTED_TYPES.has(target.type)) {
      throw new PvsError(
        `Target[${i}] unknown type "${target.type}". Supported: ${[...SUPPORTED_TYPES].join(", ")}`,
        "PVS_CONFIG_INVALID",
        { exitCode: EXIT.CONFIG_ERROR }
      );
    }

    const resolvedPath = resolve(root, target.file);
    const rel = relative(resolve(root), resolvedPath);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new PvsError(
        `Unsafe path: "${target.file}" resolves outside project root`,
        "PVS_UNSAFE_PATH",
        { exitCode: EXIT.UNSAFE_PATH, file: target.file }
      );
    }

    validateTargetFields(target, i);

    return { ...target, _resolved: resolvedPath };
  });

  return {
    ...config,
    targets: resolvedTargets,
    _allowSymlinks: allowSymlinks,
    _maxFileSizeBytes: maxFileSizeBytes,
    _loaded: true,
  };
}

function validateTargetFields(target, i) {
  switch (target.type) {
    case "marker":
      if (!target.id) throw new PvsError(`Target[${i}] marker requires "id"`, "PVS_CONFIG_INVALID", { exitCode: EXIT.CONFIG_ERROR });
      if (!target.template) throw new PvsError(`Target[${i}] marker requires "template"`, "PVS_CONFIG_INVALID", { exitCode: EXIT.CONFIG_ERROR });
      break;
    case "replace":
      if (!target.match) throw new PvsError(`Target[${i}] replace requires "match"`, "PVS_CONFIG_INVALID", { exitCode: EXIT.CONFIG_ERROR });
      if (!target.replace) throw new PvsError(`Target[${i}] replace requires "replace"`, "PVS_CONFIG_INVALID", { exitCode: EXIT.CONFIG_ERROR });
      break;
    case "json":
      if (!target.values || typeof target.values !== "object") throw new PvsError(`Target[${i}] json requires "values" object`, "PVS_CONFIG_INVALID", { exitCode: EXIT.CONFIG_ERROR });
      break;
    case "generated":
      if (!target.template) throw new PvsError(`Target[${i}] generated requires "template"`, "PVS_CONFIG_INVALID", { exitCode: EXIT.CONFIG_ERROR });
      break;
  }
}
