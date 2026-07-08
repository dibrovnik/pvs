# Contributing to pvs

Thanks for considering a contribution. `pvs` is a zero-runtime-dependency CLI, and keeping it that way is the
project's main constraint — please read the note below before adding anything to `dependencies`.

Please also read the [Code of Conduct](CODE_OF_CONDUCT.md) — participation in this project means abiding by it.

## Setup

```bash
git clone git@github.com:dibrovnik/pvs.git
cd pvs
npm run check   # node --check bin/pvs.js && node --test
```

Node.js >= 20.11 is required (see `engines` in `package.json`).

## Zero-dependency policy

`dependencies` in `package.json` must stay `{}`. Use only:

- Node.js built-ins (`node:fs`, `node:path`, `node:child_process`, ...)
- Code already in `src/core/`

`devDependencies` for tooling (linting, etc.) are open to discussion, but anything that ships to consumers is not.

## Making changes

1. Open an issue first for anything beyond a small fix, so we can agree on the approach.
2. Add or update tests under `test/` — `node --test`, no test framework dependency. Every new behavior needs a test
   that fails without the change.
3. Update `README.md` and `schema/pvs.schema.json` if you change config shape or CLI flags.
4. Run `npm run check` before opening a PR.

## Commit messages

This repo follows [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`,
...) and uses `pvs` itself (`pvs bump auto --changelog`) to generate `CHANGELOG.md` from them — so the commit
message you write is the changelog entry an end user reads.

## Reporting bugs / security issues

- Bugs: open a [GitHub issue](https://github.com/dibrovnik/pvs/issues) with the version, Node version, and exact
  command/output.
- Security vulnerabilities: see [SECURITY.md](SECURITY.md) — please don't open a public issue.
