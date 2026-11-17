import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const made = new Set();
let hooked = false;

function sweep() {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
  made.clear();
}

function hook() {
  if (hooked) return;
  hooked = true;
  process.on('exit', sweep);
  // A signal's default action skips 'exit' hooks, so turn it into a normal exit (which runs sweep) with the shell's code.
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
    process.on(signal, () => { sweep(); process.exit(code); });
  }
}

/** A new folder under the OS temp dir that is removed when this process ends (exit, error, Ctrl-C, kill). */
export function tempDir(prefix) {
  hook();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.add(dir);
  return dir;
}

/** Removes a folder made by tempDir now (a test's own cleanup); a no-op for any other path's registration. */
export function dropTempDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  made.delete(dir);
}
