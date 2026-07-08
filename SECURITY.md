# Security Policy

## Supported Versions

Only the latest published version of `@dibrovnik/pvs` on npm receives security fixes.

## Design constraints that limit exposure

- **Zero runtime dependencies** — no transitive dependency CVE surface.
- **No network requests** — `pvs` never phones home.
- **No install scripts** (`preinstall`/`postinstall`).
- **JSON-only configuration** — no arbitrary code execution from `pvs.config.json`.
- **Path containment** — all target file paths are validated to stay within the project root before any write.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

1. Preferred: use [GitHub's private vulnerability reporting](https://github.com/dibrovnik/pvs/security/advisories/new)
   for this repository.
2. Alternatively, email **mr.lololoshka200412@gmail.com** with a description and reproduction steps.

You should get an initial response within a few days. Once a fix is available, it will be published to npm and
noted in `CHANGELOG.md`.
