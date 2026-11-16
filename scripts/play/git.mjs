// Runs git commands for the play build, with an optional private index file so the working tree and the real index are never touched.
import { execFileSync } from 'node:child_process';

/** Runs `git args` in `repo` and returns trimmed stdout; `env` is merged over the process environment. */
export function git(repo, args, env = {}) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 1 << 28 }).trim();
}
