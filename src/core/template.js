export function applyTemplate(template, vars) {
  return template.replace(/\$([a-zA-Z][a-zA-Z0-9]*)/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return vars[name];
    }
    return match;
  });
}

export function buildVars(version, parsed, extra = {}) {
  const now = extra.now instanceof Date ? extra.now : new Date();
  const isoDate = now.toISOString();
  const date = isoDate.slice(0, 10);
  const build = date.replace(/-/g, "");

  return {
    version,
    major: String(parsed.major),
    minor: String(parsed.minor),
    patch: String(parsed.patch),
    prerelease: parsed.prerelease || "",
    build,
    isoDate,
    date,
    gitSha: extra.gitSha || "",
    gitShaLong: extra.gitShaLong || "",
  };
}
