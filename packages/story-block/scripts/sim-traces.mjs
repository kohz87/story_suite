// node scripts/sim-traces.mjs <sim.py> [out.json]   (or SIM_PY=<sim.py>)
//
// Regenerates the combat golden traces: runs the design simulator's scripted-dice mode (`sim.py --trace`,
// rule set v8.1) over the cases in scripts/sim-trace-cases.json and writes
// tests/v2/lean-rpg/v1/fixtures/sim-traces.json, stamped with the simulator's SHA-256 so a stale fixture
// shows. Test fixture tooling only; the product never reads it. Plain Node and python3, no dependencies.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CASES = join(HERE, 'sim-trace-cases.json');
const FIXTURE = join(HERE, '..', 'tests', 'v2', 'lean-rpg', 'v1', 'fixtures', 'sim-traces.json');

const sim = process.argv[2] ?? process.env.SIM_PY;
if (!sim) {
    console.error('usage: node scripts/sim-traces.mjs <path to sim.py> [out.json]');
    process.exit(2);
}
const simPath = resolve(sim);
const out = resolve(process.argv[3] ?? FIXTURE);
const dir = mkdtempSync(join(tmpdir(), 'sim-traces-'));
try {
    const raw = join(dir, 'raw.json');
    // -I: isolated mode, so nothing next to the script or in the cwd is imported.
    execFileSync('python3', ['-I', simPath, '--trace', CASES, raw], { stdio: 'inherit' });
    const traces = JSON.parse(readFileSync(raw, 'utf8'));
    const sha = createHash('sha256').update(readFileSync(simPath)).digest('hex');
    const body = { rules: traces.rules, simSha256: sha, cases: traces.cases };
    writeFileSync(out, JSON.stringify(body, null, 1) + '\n');
    console.log(`wrote ${traces.cases.length} traces to ${out}`);
} finally {
    rmSync(dir, { recursive: true, force: true });
}
