import { spawnSync } from 'node:child_process';

// Node options that take their value as the next word.
const VALUE_OPTIONS = new Set([
  '--import', '--require', '-r', '--test-reporter', '--test-reporter-destination', '--test-name-pattern',
  '--test-skip-pattern', '--test-concurrency', '--test-timeout', '--test-shard', '--test-isolation',
  '--experimental-test-coverage-include', '--experimental-test-coverage-exclude', '--loader', '--env-file',
]);
const ASSIGNMENTS = /^(\s*[A-Za-z_]\w*=("[^"]*"|'[^']*'|\S*))+/;

/**
 * Returns the paths and globs that one `node --test ...` command passes to Node: the words are evaluated by
 * /bin/sh in the package folder (so unquoted globs are expanded exactly as npm test does), then Node's
 * options (and the values of the ones that take one) are dropped. Returns null when the command is not a
 * `node ... --test` command. Words with glob characters are the ones the shell left for Node to expand.
 */
export function nodeTestPaths(command, cwd) {
  const text = command.trim().replace(ASSIGNMENTS, '').trim();
  if (!/^node\s/.test(text)) return null;
  const run = spawnSync('/bin/sh', ['-c', text.replace(/^node/, "printf '%s\\0'")], { cwd, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`could not evaluate the test command "${command}": ${run.stderr}`);
  const words = run.stdout.split('\0').slice(0, -1);
  const at = words.indexOf('--test');
  if (at < 0) return null;
  const paths = [];
  for (let i = at + 1; i < words.length; i++) {
    if (VALUE_OPTIONS.has(words[i])) i++;
    else if (!words[i].startsWith('-')) paths.push(words[i].replace(/^\.\//, ''));
  }
  return paths;
}
