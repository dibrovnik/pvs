import { readFileSync, statSync, existsSync } from "node:fs";
import { PvsError, EXIT } from "./errors.js";
import { applyTemplate } from "./template.js";

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readTargetFile(filePath, label, maxBytes) {
  if (!existsSync(filePath)) {
    throw new PvsError(
      `Target file not found: ${label}`,
      "PVS_TARGET_NOT_FOUND",
      { exitCode: EXIT.FS_ERROR, file: filePath }
    );
  }

  const stat = statSync(filePath);
  if (stat.size > maxBytes) {
    throw new PvsError(
      `File too large: ${label} (${stat.size} bytes, limit ${maxBytes})`,
      "PVS_FILE_TOO_LARGE",
      { exitCode: EXIT.FS_ERROR, file: filePath }
    );
  }

  const buf = readFileSync(filePath);
  if (isBinary(buf)) {
    throw new PvsError(
      `Binary file not supported: ${label}`,
      "PVS_BINARY_FILE",
      { exitCode: EXIT.FS_ERROR, file: filePath }
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

  if (target.requireGit && !vars.gitSha) {
    throw new PvsError(
      `Target "${target.file}" requires git, but git is unavailable or --no-git was specified`,
      "PVS_CONFIG_INVALID",
      { exitCode: EXIT.CONFIG_ERROR }
    );
  }

  switch (target.type) {
    case "marker":
      return processMarker(target, vars, filePath, maxBytes);
    case "replace":
      return processReplace(target, vars, filePath, maxBytes);
    case "json":
      return processJson(target, vars, filePath, maxBytes);
    case "generated":
      return processGenerated(target, vars, filePath);
    default:
      throw new PvsError(
        `Unknown target type: ${target.type}`,
        "PVS_CONFIG_INVALID",
        { exitCode: EXIT.CONFIG_ERROR }
      );
  }
}

function processMarker(target, vars, filePath, maxBytes) {
  const content = readTargetFile(filePath, target.file, maxBytes);
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
      { exitCode: EXIT.FS_ERROR, file: filePath }
    );
  }
  if (matches.length > 1 && !target.multiple) {
    throw new PvsError(
      `Multiple marker blocks '${id}' found in ${target.file}. Add "multiple": true to allow.`,
      "PVS_TARGET_MULTI_MATCH",
      { exitCode: EXIT.FS_ERROR, file: filePath }
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

function processReplace(target, vars, filePath, maxBytes) {
  const content = readTargetFile(filePath, target.file, maxBytes);

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
      { exitCode: EXIT.FS_ERROR, file: filePath }
    );
  }
  if (matches.length > 1 && !target.multiple) {
    throw new PvsError(
      `${matches.length} matches for pattern in ${target.file}. Add "multiple": true to allow.`,
      "PVS_TARGET_MULTI_MATCH",
      { exitCode: EXIT.FS_ERROR, file: filePath }
    );
  }

  const replacement = applyTemplate(target.replace, vars);
  // Escape $ in replacement string so String.replace doesn't interpret $1, $& etc.
  const safeReplacement = replacement.replace(/\$/g, "$$$$");
  const result = content.replace(re, safeReplacement);

  return { filePath, content: result };
}

function processJson(target, vars, filePath, maxBytes) {
  const content = readTargetFile(filePath, target.file, maxBytes);
  const indent = detectJsonIndent(content);
  const trailingNewline = content.endsWith("\n");

  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    throw new PvsError(
      `Invalid JSON in ${target.file}: ${err.message}`,
      "PVS_CONFIG_INVALID",
      { exitCode: EXIT.FS_ERROR, file: filePath }
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
