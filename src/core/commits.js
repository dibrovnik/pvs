// Conventional Commits parsing — https://www.conventionalcommits.org/
const HEADER_RE = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
const BREAKING_FOOTER_RE = /BREAKING[ -]CHANGE:\s*([\s\S]+)/;

export function parseConventionalCommit(hash, subject, body = "") {
  const breakingFooter = BREAKING_FOOTER_RE.exec(body);
  const m = HEADER_RE.exec(subject.trim());

  if (!m) {
    return {
      hash,
      type: "other",
      scope: "",
      breaking: !!breakingFooter,
      breakingNote: breakingFooter ? breakingFooter[1].trim() : "",
      subject: subject.trim(),
    };
  }

  const [, type, scope, bang, description] = m;

  return {
    hash,
    type,
    scope: scope || "",
    breaking: Boolean(bang) || !!breakingFooter,
    breakingNote: breakingFooter ? breakingFooter[1].trim() : "",
    subject: description.trim(),
  };
}

export function resolveBumpType(commits) {
  let hasFeat = false;

  for (const c of commits) {
    if (c.breaking) return "major";
    if (c.type === "feat") hasFeat = true;
  }

  return hasFeat ? "minor" : "patch";
}
