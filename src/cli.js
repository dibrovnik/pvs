import { readFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { bump } from "./commands/bump.js";
import { sync } from "./commands/sync.js";
import { check } from "./commands/check.js";
import { current } from "./commands/current.js";
import { init } from "./commands/init.js";
import { PvsError, EXIT } from "./core/errors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Flags that consume the next positional token as their value
const VALUE_FLAGS = new Set([
  "config",
  "root",
  "preid",
  "tag-prefix",
  "message",
]);

function parseArgs(argv) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (key.startsWith("no-")) {
        flags[key.slice(3)] = false;
      } else if (VALUE_FLAGS.has(key)) {
        flags[key] = argv[++i] ?? "";
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

function buildOptions(flags) {
  return {
    root: typeof flags["root"] === "string" ? flags["root"] : undefined,
    config: typeof flags["config"] === "string" ? flags["config"] : undefined,
    dryRun: flags["dry-run"] === true,
    json: flags["json"] === true,
    quiet: flags["quiet"] === true,
    verbose: flags["verbose"] === true,
    noLockfile: flags["lockfile"] === false,
    noGit: flags["git"] === false,
    allowDirty: flags["allow-dirty"] === true,
    preid: typeof flags["preid"] === "string" ? flags["preid"] : "",
    commit: flags["commit"] === true,
    tag: flags["tag"] === true,
    tagPrefix: typeof flags["tag-prefix"] === "string" ? flags["tag-prefix"] : "v",
    message: typeof flags["message"] === "string" ? flags["message"] : undefined,
  };
}

function pvsVersion() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function toJson(data) {
  return JSON.stringify(data, null, 2);
}

export async function runCli(argv) {
  const { flags, positional } = parseArgs(argv);
  const command = positional[0];

  if (flags["version"]) {
    process.stdout.write(pvsVersion() + "\n");
    return;
  }

  if (flags["help"] || !command) {
    printHelp();
    return;
  }

  const options = buildOptions(flags);
  const { json, quiet } = options;
  const root = resolve(options.root || process.cwd());

  switch (command) {
    case "bump": {
      const release = positional[1];
      if (!release) {
        throw new PvsError(
          "Usage: pvs bump <patch|minor|major|prerelease|X.Y.Z>",
          "PVS_CONFIG_INVALID",
          { exitCode: EXIT.CONFIG_ERROR }
        );
      }

      if (!quiet && !json) {
        process.stdout.write(`pvs ${pvsVersion()}\n\n`);
      }

      const result = await bump(release, { ...options, root });

      if (json) {
        process.stdout.write(toJson({ ok: true, ...result }) + "\n");
      } else if (!quiet) {
        process.stdout.write(`Version:\n  ${result.oldVersion} -> ${result.newVersion}\n\n`);
        process.stdout.write((options.dryRun ? "Would change:" : "Changed:") + "\n");
        for (const f of result.changedFiles) {
          process.stdout.write(`  ${f}\n`);
        }
      }
      break;
    }

    case "sync": {
      const result = await sync({ ...options, root });

      if (json) {
        process.stdout.write(toJson({ ok: true, ...result }) + "\n");
      } else if (!quiet) {
        process.stdout.write((options.dryRun ? "Would sync:" : "Synced:") + "\n");
        for (const f of result.changedFiles) {
          process.stdout.write(`  ${f}\n`);
        }
      }
      break;
    }

    case "check": {
      const result = await check({ ...options, root });

      if (result.mismatches.length === 0) {
        if (json) {
          process.stdout.write(toJson({ ok: true, version: result.version }) + "\n");
        } else if (!quiet) {
          process.stdout.write(`All files are synchronized at ${result.version}\n`);
        }
      } else {
        if (json) {
          process.stdout.write(toJson({ ok: false, version: result.version, mismatches: result.mismatches }) + "\n");
        } else {
          process.stdout.write(`Version mismatch:\n- package.json: ${result.version}\n`);
          for (const m of result.mismatches) {
            process.stdout.write(`- ${m.file}: ${m.reason}\n`);
          }
          process.stdout.write("\nRun: pvs sync\n");
        }
        process.exitCode = EXIT.MISMATCH;
      }
      break;
    }

    case "current": {
      const result = await current({ ...options, root });

      if (json) {
        process.stdout.write(toJson(result) + "\n");
      } else {
        process.stdout.write(result.version + "\n");
      }
      break;
    }

    case "init": {
      const result = await init({ ...options, root });

      if (!quiet) {
        if (json) {
          process.stdout.write(toJson({ ok: true, created: result.created }) + "\n");
        } else {
          process.stdout.write(`Created ${relative(process.cwd(), result.created)}\n`);
        }
      }
      break;
    }

    default:
      throw new PvsError(
        `Unknown command: "${command}". Run pvs --help for usage.`,
        "PVS_CONFIG_INVALID",
        { exitCode: EXIT.CONFIG_ERROR }
      );
  }
}

function printHelp() {
  process.stdout.write(`pvs — Project Version Sync

Usage:
  pvs bump <patch|minor|major|prerelease|X.Y.Z> [options]
  pvs sync [options]
  pvs check [options]
  pvs current [--json]
  pvs init [--root <path>]

Commands:
  bump      Increment version and write all targets
  sync      Write current version to all targets (no version change)
  check     Verify all targets match current version (exit 1 on mismatch)
  current   Print current version from package.json
  init      Create a minimal pvs.config.json

Global options:
  --config <path>    Config file (default: pvs.config.json)
  --root <path>      Project root (default: cwd)
  --dry-run          Show plan without writing any files
  --json             Machine-readable JSON output
  --quiet            Suppress non-error output
  --no-lockfile      Skip package-lock.json / npm-shrinkwrap.json
  --no-git           Skip git metadata and repo checks
  --allow-dirty      Allow bump --commit/--tag with uncommitted changes
  --version          Print pvs version
  --help             Show this help

bump options:
  --preid <id>         Prerelease identifier (rc, beta, alpha)
  --commit             Create a git commit after bumping
  --tag                Create a git tag after bumping
  --tag-prefix <val>   Tag prefix (default: v)
  --message <tmpl>     Commit message template (default: "chore: release v\$version")
`);
}
