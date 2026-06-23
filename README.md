# @dibrovnik/pvs

**Project Version Sync** — zero-dependency CLI for syncing project version across `package.json`, lockfiles, and configured files.

```bash
pvs bump patch    # 1.4.1 → 1.4.2
pvs bump minor    # 1.4.2 → 1.5.0
pvs bump major    # 1.5.0 → 2.0.0
pvs sync          # write current version to all targets
pvs check         # verify all targets match, exit 1 on mismatch
pvs current       # print current version
pvs init          # create pvs.config.json
```

## Install

```bash
npm install -D @dibrovnik/pvs
```

## Quick start

```bash
pvs init
```

Edit the generated `pvs.config.json`:

```json
{
  "schemaVersion": 1,
  "targets": [
    {
      "file": "src/generated/version.ts",
      "type": "generated",
      "template": "export const APP_VERSION = \"$version\";\n"
    },
    {
      "file": "public/version.json",
      "type": "json",
      "values": {
        "version": "$version",
        "major": "$major",
        "minor": "$minor",
        "patch": "$patch"
      }
    }
  ]
}
```

Then bump:

```bash
pvs bump patch
```

Output:

```
pvs 0.1.0

Version:
  1.4.1 -> 1.4.2

Changed:
  package.json
  package-lock.json
  src/generated/version.ts
  public/version.json
```

## Target types

### `marker` — update a fenced block

```ts
// pvs:start app-version
export const APP_VERSION = "1.4.1";
// pvs:end app-version
```

Config:

```json
{
  "file": "src/version.ts",
  "type": "marker",
  "id": "app-version",
  "template": "export const APP_VERSION = \"$version\";"
}
```

### `replace` — regex replacement

```json
{
  "file": "README.md",
  "type": "replace",
  "match": "Current version: v[0-9]+\\.[0-9]+\\.[0-9]+",
  "replace": "Current version: v$version"
}
```

By default, the regex must match exactly once. Add `"multiple": true` to allow more.

### `json` — update JSON keys

```json
{
  "file": "public/version.json",
  "type": "json",
  "values": {
    "version": "$version",
    "build.iso": "$isoDate"
  }
}
```

Nested keys use dot notation. Indentation and trailing newline are preserved.

### `generated` — overwrite entire file

```json
{
  "file": "src/generated/version.ts",
  "type": "generated",
  "template": "export const APP_VERSION = \"$version\";\n"
}
```

## Template variables

| Variable | Example |
|---|---|
| `$version` | `1.4.2` |
| `$major` | `1` |
| `$minor` | `4` |
| `$patch` | `2` |
| `$prerelease` | `rc.1` |
| `$build` | `20260622` |
| `$isoDate` | `2026-06-22T14:35:00.000Z` |
| `$date` | `2026-06-22` |
| `$gitSha` | `abc1234` |
| `$gitShaLong` | full commit SHA |

## Global options

```
--config <path>    Config file (default: pvs.config.json)
--root <path>      Project root (default: cwd)
--dry-run          Show plan without writing files
--json             Machine-readable JSON output
--quiet            Only errors
--verbose          Verbose output
--no-lockfile      Skip lockfile updates
--no-git           Skip git metadata
--allow-dirty      Allow bump --commit/--tag with dirty working tree
--version          Print pvs version
--help             Show help
```

## `bump` options

```
--preid <id>         Prerelease identifier: rc, beta, alpha
--commit             Create a git commit
--tag                Create a git tag
--tag-prefix <val>   Tag prefix (default: v)
--message <tmpl>     Commit message template (default: "chore: release v$version")
```

## Use with `npm version`

```json
{
  "scripts": {
    "version": "pvs sync && git add -A"
  }
}
```

## Security

- **Zero runtime dependencies** — no transitive CVE surface.
- **JSON-only config** — no arbitrary code execution.
- **Path containment** — all target paths are checked to stay within project root.
- **No install scripts** — `preinstall`/`postinstall` are absent.
- **No network requests** — fully offline.
- **File size limit** — 2 MB per target by default (configurable).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success / all in sync |
| `1` | Version mismatch (`pvs check`) |
| `2` | Config error |
| `3` | Filesystem error |
| `4` | Invalid SemVer |
| `5` | Unsafe path |

## Requirements

- Node.js >= 20.11

## License

MIT
