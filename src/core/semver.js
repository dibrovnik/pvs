import { PvsError, EXIT } from "./errors.js";

// Full SemVer 2.0.0 regex — no leading zeros, optional prerelease and build metadata
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const RELEASE_TYPES = new Set([
  "patch",
  "minor",
  "major",
  "prepatch",
  "preminor",
  "premajor",
  "prerelease",
]);

export function parseVersion(version) {
  if (typeof version !== "string" || version.trim() !== version) {
    throw new PvsError(
      `Invalid SemVer: "${version}"`,
      "PVS_VERSION_INVALID",
      { exitCode: EXIT.SEMVER_ERROR }
    );
  }
  const m = SEMVER_RE.exec(version);
  if (!m) {
    throw new PvsError(
      `Invalid SemVer: "${version}"`,
      "PVS_VERSION_INVALID",
      { exitCode: EXIT.SEMVER_ERROR }
    );
  }
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] || "",
    build: m[5] || "",
  };
}

export function isReleaseType(value) {
  return RELEASE_TYPES.has(value);
}

export function incrementVersion(version, release, preid = "") {
  const v = parseVersion(version);

  switch (release) {
    case "major":
      return `${v.major + 1}.0.0`;
    case "minor":
      return `${v.major}.${v.minor + 1}.0`;
    case "patch":
      return `${v.major}.${v.minor}.${v.patch + 1}`;
    case "premajor": {
      const pre = preid ? `${preid}.0` : "0";
      return `${v.major + 1}.0.0-${pre}`;
    }
    case "preminor": {
      const pre = preid ? `${preid}.0` : "0";
      return `${v.major}.${v.minor + 1}.0-${pre}`;
    }
    case "prepatch": {
      const pre = preid ? `${preid}.0` : "0";
      return `${v.major}.${v.minor}.${v.patch + 1}-${pre}`;
    }
    case "prerelease": {
      if (v.prerelease) {
        const parts = v.prerelease.split(".");
        let incremented = false;
        for (let i = parts.length - 1; i >= 0; i--) {
          if (/^\d+$/.test(parts[i])) {
            parts[i] = String(Number(parts[i]) + 1);
            incremented = true;
            break;
          }
        }
        if (!incremented) parts.push("0");
        return `${v.major}.${v.minor}.${v.patch}-${parts.join(".")}`;
      } else {
        const pre = preid ? `${preid}.0` : "0";
        return `${v.major}.${v.minor}.${v.patch + 1}-${pre}`;
      }
    }
    default: {
      // Explicit version string — validate and return as-is
      parseVersion(release);
      return release;
    }
  }
}
