// The command line: print the tables as markdown or JSON when sim-standard.mjs itself is run.
import { rollTable } from './rolls.js';
import { fightTable } from './fights.js';
import { markdown } from './report.js';

export function runCli() {
    if (`file://${process.argv[1]}` !== new URL('../sim-standard.mjs', import.meta.url).href) return;
    const rolls = rollTable(), fights = fightTable();
    console.log(process.argv.includes('--json') ? JSON.stringify({ rolls, fights }, null, 1) : markdown(rolls, fights));
}

runCli();
