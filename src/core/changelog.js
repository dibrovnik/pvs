const SECTIONS = [
  { type: "feat", title: "Features" },
  { type: "fix", title: "Bug Fixes" },
  { type: "perf", title: "Performance Improvements" },
  { type: "revert", title: "Reverts" },
];

const HEADER = "# Changelog\n\nAll notable changes to this project will be documented in this file.\n";

export function groupCommits(commits) {
  const breaking = [];
  const buckets = new Map(SECTIONS.map((s) => [s.type, []]));

  for (const c of commits) {
    if (c.breaking) breaking.push(c);
    if (buckets.has(c.type)) buckets.get(c.type).push(c);
  }

  return {
    breaking,
    sections: SECTIONS.map((s) => ({ title: s.title, commits: buckets.get(s.type) })).filter(
      (s) => s.commits.length > 0
    ),
  };
}

function formatEntry(c) {
  const scope = c.scope ? `**${c.scope}:** ` : "";
  return `- ${scope}${c.subject} (${c.hash.slice(0, 7)})`;
}

export function renderChangelogSection(version, date, grouped) {
  const lines = [`## ${version} (${date})`, ""];

  if (grouped.breaking.length > 0) {
    lines.push("### BREAKING CHANGES", "");
    for (const c of grouped.breaking) {
      lines.push(`- ${c.breakingNote || c.subject} (${c.hash.slice(0, 7)})`);
    }
    lines.push("");
  }

  for (const section of grouped.sections) {
    lines.push(`### ${section.title}`, "");
    for (const c of section.commits) {
      lines.push(formatEntry(c));
    }
    lines.push("");
  }

  // drop trailing blank lines, keep exactly one trailing newline
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n") + "\n";
}

export function prependChangelog(existingContent, entrySection) {
  const trimmed = (existingContent || "").trim();

  if (!trimmed) {
    return `${HEADER}\n${entrySection}\n`;
  }

  const insertAt = trimmed.search(/\n## /);
  if (insertAt === -1) {
    return `${trimmed}\n\n${entrySection}\n`;
  }

  return `${trimmed.slice(0, insertAt + 1)}\n${entrySection}\n${trimmed.slice(insertAt + 1)}\n`;
}
