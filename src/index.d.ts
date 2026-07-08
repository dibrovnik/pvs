export interface Semver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
  build: string;
}

export interface BumpOptions {
  root?: string;
  config?: string;
  dryRun?: boolean;
  noLockfile?: boolean;
  noGit?: boolean;
  allowDirty?: boolean;
  preid?: string;
  commit?: boolean;
  tag?: boolean;
  tagPrefix?: string;
  message?: string;
  changelog?: boolean;
  changelogFile?: string;
}

export interface ChangelogOptions {
  root?: string;
  dryRun?: boolean;
  changelogFile?: string;
  tagPrefix?: string;
  from?: string;
  version?: string;
  now?: Date;
}

export interface ChangelogResult {
  file: string;
  version: string;
  from: string;
  commitCount: number;
}

export interface ConventionalCommit {
  hash: string;
  type: string;
  scope: string;
  breaking: boolean;
  breakingNote: string;
  subject: string;
}

export interface SyncOptions {
  root?: string;
  config?: string;
  dryRun?: boolean;
  noGit?: boolean;
}

export interface BumpResult {
  oldVersion: string;
  newVersion: string;
  changedFiles: string[];
}

export interface CheckResult {
  version: string;
  mismatches: Array<{ file: string; reason: string }>;
}

export declare function bump(release: string, options?: BumpOptions): Promise<BumpResult>;
export declare function sync(options?: SyncOptions): Promise<{ version: string; changedFiles: string[] }>;
export declare function check(options?: SyncOptions): Promise<CheckResult>;
export declare function changelog(options?: ChangelogOptions): Promise<ChangelogResult>;
export declare function parseVersion(version: string): Semver;
export declare function incrementVersion(version: string, release: string, preid?: string): string;
export declare function parseConventionalCommit(hash: string, subject: string, body?: string): ConventionalCommit;
export declare function resolveBumpType(commits: ConventionalCommit[]): "major" | "minor" | "patch";
