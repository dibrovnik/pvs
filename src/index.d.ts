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
export declare function parseVersion(version: string): Semver;
export declare function incrementVersion(version: string, release: string, preid?: string): string;
