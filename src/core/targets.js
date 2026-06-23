import { readFileSync, statSync, existsSync, lstatSync } from "node:fs";
import { PvsError, EXIT } from "./errors.js";
import { applyTemplate } from "./template.js";

// Maximum regex string length for replace targets — prevents runaway backtracking
const MAX_REGEX_LENGTH = 500;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkSymlink(filePath, label, allowSymlinks) {
  if (allowSymlinks) return;
  let lstat;
  try {
    lstat = lstatSync(filePath);
  } catch {
    return; // file doesn't exist yet (e.g. generated target), nothing to check
  }
  if (lstat.isSymbolicLink()) {
    throw new PvsError(
      `Symlink not allowed: ${label}. Set "allowSymlinks": true in pvs.config.json to enable.`,
      "PVS_UNSAFE_PATH",
      { exitCode: EXIT.UNSAFE_PATH, file: filePath }
    );
  }
}

function readTargetFile(filePath, label, maxBytes, allowSymlinks) {
  if (!existsSync(filePath)) {
    throw new PvsError(
      `Target file not found: ${label}`,
      "PVS_TARGET_NOT_FOUND",
      { exitCode: EXIT.FS_ERROR, file: label }
    );
  }

  checkSymlink(filePath, label, allowSymlinks);

  const stat = statSync(filePath);
  if (stat.size > maxBytes) {
    throw new PvsError(
      `File too large: ${label} (${stat.size} bytes, limit ${maxBytes})`,
      "PVS_FILE_TOO_LARGE",
      { exitCode: EXIT.FS_ERROR, file: label }
    );
  }

  const buf = readFileSync(filePath);
  if (isBinary(buf)) {
    throw new PvsError(
      `Binary file not supported: ${label}`,
      "PVS_BINARY_FILE",
      { exitCode: EXIT.FS_ERROR, file: label }
    );
  }

  return buf.toString("utf8");
}

function isBinary(buf) {
  const limit = Math.min(buf.length, 8000);
  for (let i = 0; i < limit; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

export function processTarget(target, vars, config = {}) {
  const filePath = target._resolved;
  const maxBytes = config._maxFileSizeBytes ?? 2 * 1024 * 1024;
  const allowSymlinks = config._allowSymlinks === true;

  if (target.requireGit && !vars.gitSha) {
    throw new PvsError(
      `Target "${target.file}" requires git, but git is unavailable or --no-git was specified`,
      "PVS_CONFIG_INVALID",
      { exitCode: EXIT.CONFIG_ERROR }
    );
  }

  switch (target.type) {
    case "marker":
      return processMarker(target, vars, filePath, maxBytes, allowSymlinks);
    case "replace":
      return processReplace(target, vars, filePath, maxBytes, allowSymlinks);
    case "json":
      return processJson(target, vars, filePath, maxBytes, allowSymlinks);
    case "generated":
      // generated does not read the file, but check symlink on the destination
      checkSymlink(filePath, target.file, allowSymlinks);
      return processGenerated(target, vars, filePath);
    default:
      throw new PvsError(
        `Unknown target type: ${target.type}`,
        "PVS_CONFIG_INVALID",
        { exitCode: EXIT.CONFIG_ERROR }
      );
  }
}

function processMarker(target, vars, filePath, maxBytes, allowSymlinks) {
  const content = readTargetFile(filePath, target.file, maxBytes, allowSymlinks);
  const id = target.id;
  const escapedId = escapeRegex(id);

  // Matches the full block: start-line \n ... end-line
  // Captures: (1) start line including newline, (2) inner content, (3) end line
  const blockRe = new RegExp(
    `([^\\n]*pvs:start\\s+${escapedId}[^\\n]*\\n)` +
      `([\\s\\S]*?)` +
      `([^\\n]*pvs:end\\s+${escapedId}[^\\n]*)`,
    "g"
  );

  const matches = [...content.matchAll(blockRe)];

  if (matches.length === 0) {
    throw new PvsError(
      `No marker block '${id}' found in ${target.file}`,
      "PVS_TARGET_NO_MATCH",
      { exitCode: EXIT.FS_ERROR, file: target.file }
    );
  }
  if (matches.length > 1 && !target.multiple) {
    throw new PvsError(
      `Multiple marker blocks '${id}' found in ${target.file}. Add "multiple": true to allow.`,
      "PVS_TARGET_MULTI_MATCH",
      { exitCode: EXIT.FS_ERROR, file: target.file }
    );
  }

  const newInner = applyTemplate(target.template, vars);
  const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";

  const result = content.replace(
    blockRe,
    (_, startLine, _inner, endLine) =>
      startLine + newInner + lineEnding + endLine
  );

  return { filePath, content: result };
}

function processReplace(target, vars, filePath, maxBytes, allowSymlinks) {
  const content = readTargetFile(filePath, target.file, maxBytes, allowSymlinks);

  if (target.match.length > MAX_REGEX_LENGTH) {
    throw new PvsError(
      `Regex pattern too long in target "${target.file}" (${target.match.length} chars, max ${MAX_REGEX_LENGTH}). Use a shorter, more specific pattern.`,
      "PVS_CONFIG_INVALID",
      { exitCode: EXIT.CONFIG_ERROR }
    );
  }

  let re;
  try {
    re = new RegExp(target.match, "g");
  } catch (err) {
    throw new PvsError(
      `Invalid regex in target "${target.file}": ${err.message}`,
      "PVS_CONFIG_INVALID",
      { exitCode: EXIT.CONFIG_ERROR }
    );
  }

  const matches = [...content.matchAll(re)];

  if (matches.length === 0) {
    throw new PvsError(
      `No matches for pattern in ${target.file}: ${target.match}`,
      "PVS_TARGET_NO_MATCH",
      { exitCode: EXIT.FS_ERROR, file: target.file }
    );
  }
  if (matches.length > 1 && !target.multiple) {
    throw new PvsError(
      `${matches.length} matches for pattern in ${target.file}. Add "multiple": true to allow.`,
      "PVS_TARGET_MULTI_MATCH",
      { exitCode: EXIT.FS_ERROR, file: target.file }
    );
  }

  const replacement = applyTemplate(target.replace, vars);
  // Escape $ so String.replace doesn't interpret $1, $& etc. as backreferences
  const safeReplacement = replacement.replace(/\$/g, "$$$$");
  const result = content.replace(re, safeReplacement);

  return { filePath, content: result };
}

function processJson(target, vars, filePath, maxBytes, allowSymlinks) {
  const content = readTargetFile(filePath, target.file, maxBytes, allowSymlinks);
  const indent = detectJsonIndent(content);
  const trailingNewline = content.endsWith("\n");

  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    throw new PvsError(
      `Invalid JSON in ${target.file}: ${err.message}`,
      "PVS_CONFIG_INVALID",
      { exitCode: EXIT.FS_ERROR, file: target.file }
    );
  }

  const updated = JSON.parse(JSON.stringify(data));
  for (const [keyPath, tmpl] of Object.entries(target.values)) {
    const value = applyTemplate(tmpl, vars);
    setByPath(updated, keyPath.split("."), value);
  }

  let result = JSON.stringify(updated, null, indent);
  if (trailingNewline) result += "\n";

  return { filePath, content: result };
}

function processGenerated(target, vars, filePath) {
  const content = applyTemplate(target.template, vars);
  return { filePath, content };
}

function setByPath(obj, parts, value) {
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function detectJsonIndent(str) {
  const m = str.match(/^\s*\{[\r\n]+([ \t]+)/);
  if (!m) return 2;
  const s = m[1];
  if (s[0] === "\t") return "\t";
  return s.length >= 4 ? 4 : 2;
}
