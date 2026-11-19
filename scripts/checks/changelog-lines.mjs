import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CHANGELOG.md is read by players on GitHub: each bullet is one short line in their words; the long record is docs/history/CHANGELOG-detail.md.
export const MAX_BULLET = 300;

// Internal job and batch names. Real capitalised words (HP, RPG, NPC, STR, DEX, JSON) carry no digit and are not listed, so they pass.
const JOB_PATTERNS = [
  /\b[A-Z]{2,}[0-9]+[A-Z0-9]*\b/,       // LF4E, SOAK2UI, PF4FIX, ABJUDGE17
  /\b[A-Z]{1,}[0-9]*-[0-9]+[A-Z]?\b/,   // NB-1, B4-12
  /\b(?:SOAK|SOAKUI|REV|FIXBATCH|LIVE|NSD|LPA|LPB|LAWA|LACA|NBFIGHT|PACKLORE|PLSTUDIO|PLDOCS|DOCSREFRESH|WALKNEXT|PEOPLEFIX|UIFIX|PERFAUDIT)\b/,
  /\bbatch (?:review )?[0-9]+\b/i,      // "Batch 3", "batch review 2"
];

/** The job id a line names, or null. */
export function jobIdIn(line) {
  for (const pattern of JOB_PATTERNS) {
    const hit = line.match(pattern);
    if (hit) return hit[0];
  }
  return null;
}

/** One problem string per bullet over MAX_BULLET characters and per line (headings aside) that names a job id. */
export function changelogProblems(text) {
  const problems = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const where = `CHANGELOG.md:${index + 1}`;
    if (/^\s*[-*] /.test(line) && line.trim().length > MAX_BULLET) problems.push(`${where}: a bullet of ${line.trim().length} characters (at most ${MAX_BULLET}); put the detail in docs/history/CHANGELOG-detail.md`);
    if (/^#/.test(line)) return;
    const id = jobIdIn(line);
    if (id) problems.push(`${where}: names the job id "${id}"; say what the player sees instead`);
  });
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../..'));
  const problems = changelogProblems(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'));
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
}
