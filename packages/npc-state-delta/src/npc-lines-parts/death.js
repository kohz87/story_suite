// The `~ npc Name | died | how: one sentence` line (NSD13): a named person died. Only while lines mode is on (off, the line goes the old way, byte for byte);
// untaught until N7. The death is the reply's own write (`people.died` in the line's transaction, stamped with the reply's sid, never a clock), so a swipe,
// a middle delete, a Re-read, a rewind and a reload decide it again the same way. A death is final: the same record then refuses `where:` and the other frozen fields
// (./guard.js), and a person already dead, or with no record, is refused. The Director's read (`npc.known`, `npc.dossier`) sees `deceased` from the stored record.
import { clean } from '../npc-meters-config.js';
import { knownPerson } from './stub.js';

const HOW_MAX = 300;
export const DIED_FALLBACK = 'Died in the story.';

/** Whether this parsed `~ npc` line is a death line: its one text slot is the word died (`~ npc Name | died | how: …`). */
export const isDiedLine = line => line?.kind === 'npc' && line?.op === '~' && /^died\.?$/i.test(String(line?.text ?? '').trim());

/** Runs one death line → the receipt. A person with no record, or already dead, is refused and changes nothing. */
export function diedLine(ctx, line) {
    const name = clean(line?.name, 40);
    const found = knownPerson(ctx, line?.name);
    if (!found?.record) ctx.fail('REFUSED', `${name} has no record yet; write + npc ${name} | role | look first.`);
    const how = clean(line?.labels?.how, HOW_MAX);
    const sid = typeof ctx.carrier?.sid === 'string' ? ctx.carrier.sid : null;
    ctx.call('people.died', { id: found.key, reason: how || DIED_FALLBACK, sid });
    return { summary: `${name} died.`, data: { key: found.key, died: true }, narrate: false };
}
