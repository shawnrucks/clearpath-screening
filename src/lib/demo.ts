import fs from "node:fs";
import path from "node:path";

export const DEMO_RESET_ROLES = ["Administrator", "Operations Specialist"] as const;

export function isDemoResetEnabled() {
  const configured = process.env.CLEARPATH_ALLOW_DEMO_RESET;
  if (process.env.NODE_ENV === "production") return configured === "true";
  return configured !== "false";
}

export function acquireDemoResetLock() {
  const configuredDbPath = process.env.CLEARPATH_DB_PATH?.trim();
  const databasePath = configuredDbPath
    ? path.resolve(configuredDbPath)
    : path.join(process.cwd(), "data", "clearpath.sqlite3");
  const lockPath = `${databasePath}.reseed.lock`;
  fs.mkdirSync(path.dirname(lockPath), {recursive: true});

  function openLock() {
    try {
      return fs.openSync(lockPath, "wx");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      return null;
    }
  }

  let descriptor = openLock();
  if (descriptor === null) {
    try {
      const age = Date.now() - fs.statSync(lockPath).mtimeMs;
      if (age > 5 * 60 * 1000) {
        fs.unlinkSync(lockPath);
        descriptor = openLock();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      descriptor = openLock();
    }
  }
  if (descriptor === null) return null;
  const lockDescriptor = descriptor;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    fs.closeSync(lockDescriptor);
    try {
      fs.unlinkSync(lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
}
