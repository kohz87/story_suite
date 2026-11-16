import assert from 'node:assert/strict';
import { lines, makeState, runCommand } from './helpers/fake-ctx.js';
import { part } from '../../../src/v2/chronicle/index.js';

export const DAY = 1440;
export const BY = 'event:the-seventh-seal-fails';
export const SEAL = {
    name: 'Seventh seal failed', state: 'ongoing', place: 'Auvoth', factions: ['Adventurer Guild', 'Sealwardens'],
    summary: 'The seal over Auvoth has failed.', keep: true,
};
export const lasting = (state, payload, options = {}) => runCommand(state, part.commands['chronicle.lasting'], payload, { cause: 'system', caller: BY, ...options });
export const must = run => { assert.equal(run.ok, true, run.message); return run; };
export const shown = tail => tail.lines.slice(1).map(text => text.match(/^- ([^(:.]+?)(?: \(|:|\.)/)[1]);

export function crowd(count, { minutes = DAY } = {}) {
    const block = Array.from({ length: count }, (_, i) => `+ world Trouble ${i + 1} — number ${i + 1}`).join('\n');
    return lines(makeState({ minutes }), block).state;
}
