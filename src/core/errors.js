export const EXIT = {
  OK: 0,
  MISMATCH: 1,
  CONFIG_ERROR: 2,
  FS_ERROR: 3,
  SEMVER_ERROR: 4,
  UNSAFE_PATH: 5,
};

export class PvsError extends Error {
  constructor(message, code, extra = {}) {
    super(message);
    this.name = "PvsError";
    this.code = code;
    if (extra.exitCode !== undefined) this.exitCode = extra.exitCode;
    if (extra.file !== undefined) this.file = extra.file;
  }
}
