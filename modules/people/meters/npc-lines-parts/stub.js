// The `+ npc Name | role | look` stub (NSD6): a new person from one line. Code makes the person first, from the stub alone; a line that names someone already
// listed, the player or the character you play makes nobody. In lines mode a line about a person with no record (`~ npc`, `+ milestone`, the note kinds `~ lie|know|taste|tie`) is refused as well (it makes nobody).
// All of it only while lines mode is on (the hook `linesMode`; off, the line goes the old way, byte for byte).
import { labelKey } from '../../cast/key-people.js';
import { NAME_MAX, NPC_DOMAIN, clean, isObject } from '../npc-meters-config.js';
import { makeNpcId } from '../../core/core-identity.js';
import { isNoteKind } from '../../notes/npc-notes-kinds.js';
import { stubRecord } from './derived.js';

const ROLE_MAX = 60;
export const STUB_LOOK_MAX = 100;   // the approved length; a look is stored exactly as written up to it, never shorter
const STUBS_PER_REPLY = 4;   // b6-soak-2: the same four a reply as the capture block's new people (CAPTURE_NEW_NPCS_PER_BLOCK); it also bounds the fill-ins the stubs own
const PEOPLE_ID = /^npc_[\p{L}\p{N}_-]{1,100}$/u;

/** → { name, role, look, problems } from a `+ npc` line (read from the line as written: its parts are the role and the look, whatever they hold). */
export function readStub(line) {
    // The first slot is the role even when empty (`+ npc Ilse || eyes: grey` has a look and no role); only empty slots after it are dropped.
    const slots = (line?.raw === undefined ? String(line?.text ?? '').split(';') : String(line.raw).split('|').slice(1)).map(part => part.trim());
    const [role = '', ...rest] = slots;
    const looks = rest.filter(Boolean);
    const written = clean(looks.join('; '), 10000);
    const look = clean(written, STUB_LOOK_MAX);
    const problems = written.length > look.length ? [`${clean(line.name, 40)}: the look was cut to ${STUB_LOOK_MAX} characters.`] : [];
    return { name: clean(line?.name, NAME_MAX), role: clean(role, ROLE_MAX), look, problems };
}

const namesOf = record => [record?.name, ...(Array.isArray(record?.aliases) ? record.aliases : [])].map(labelKey).filter(Boolean);
const isToken = (name, key) => new RegExp(`^\\{\\{\\s*${key}\\s*\\}\\}$`, 'i').test(String(name ?? '').trim());

/** The person a name is, among the people (by name or alias) and the meter entries: { key, record? } or null. */
export function knownPerson(ctx, name) {
    const asked = labelKey(name);
    if (!asked) return null;
    const people = ctx.read('people')?.npcs;
    for (const [key, record] of Object.entries(isObject(people) ? people : {})) if (namesOf(record).includes(asked)) return { key, record };
    const bonds = ctx.read(NPC_DOMAIN)?.npcs;
    for (const [key, record] of Object.entries(isObject(bonds) ? bonds : {})) if (labelKey(record?.name) === asked) return { key };
    // Only the people and the meter entries as this reply sees them: Delta's own list is the head's, so a Re-read of an earlier reply would decide by later replies.
    return null;
}

/** The sentence refusing a stub for this name, or ''. */
function refusalOf(ctx, name, hooks) {
    if (!name) return 'The + npc line names no one: + npc Name | role | look.';
    const asked = labelKey(name);
    let players = [];
    try { players = (hooks.playerNames?.() ?? []).map(labelKey).filter(Boolean); } catch { /* no names known */ }
    if (isToken(name, 'user') || isToken(name, 'char') || players.includes(asked)) return `${name} is the player or the character you play; + npc is only for someone new.`;
    return knownPerson(ctx, name) ? `${name} is already listed; + npc is only for someone new.` : '';
}

/**
 * `handler` (the npc line handler) with the stub and the unknown-person rule in front, while lines mode is on. `deps`: { hooks, linesMode(ctx) → boolean, baseline() → meters, note(slice, rev, problems) }.
 * Runs inside the reply's transaction: a refusal makes no person and no meter entry.
 */
export function withStubs(handler, { hooks, linesMode, baseline, note }) {
    return function stubbedLine(ctx, line = {}) {
        if (!linesMode(ctx)) return handler(ctx, line);
        const on = { ...line, linesOn: true };   // (the label readers of npc-lines-parts/facts.js run only on a marked line)
        const aboutPerson = line.kind === 'npc' || line.kind === 'milestone' || isNoteKind(line.kind);
        if (!aboutPerson) return handler(ctx, on);
        if (line.kind === 'npc' && line.op === '+') {
            const stub = readStub(line);
            const refused = refusalOf(ctx, stub.name, hooks);
            if (refused) ctx.fail('REFUSED', refused);
            // This reply's stubs are the people stamped with its index (the identity the fill-in finds them by).
            const stamp = Number.isInteger(ctx.carrier?.index) ? ctx.carrier.index + 1 : 1;
            const made = Object.values(ctx.read('people')?.npcs ?? {}).filter(record => record?.createdAt === stamp).length;
            if (made >= STUBS_PER_REPLY) ctx.fail('REFUSED', `Only four new people a reply; ${stub.name} waits for a later reply that names them again.`);
            // One id for the dossier and its meter entry: free among the people and the meter entries both.
            const taken = [...Object.keys(ctx.read('people')?.npcs ?? {}), ...Object.keys(ctx.read(NPC_DOMAIN)?.npcs ?? {})];
            const id = makeNpcId(stub.name, taken);
            if (!PEOPLE_ID.test(id)) ctx.fail('INVALID', `${stub.name} cannot be given an id.`);
            ctx.call('people.stub', { id, record: stubRecord(stub, id, baseline(), stamp) });
            const out = handler(ctx, { ...on, labels: {}, name: stub.name, stubKey: id });
            if (stub.problems.length) note(ctx.draft(NPC_DOMAIN), ctx.rev, stub.problems);
            return stub.problems.length ? { ...out, data: { ...out.data, problems: [...(out.data?.problems ?? []), ...stub.problems] } } : out;
        }
        if (!knownPerson(ctx, line.name)) {
            const text = `${clean(line.name, 40)} has no record yet; write + npc ${clean(line.name, 40)} | role | look first.`;
            ctx.fail('REFUSED', text);
        }
        return handler(ctx, on);
    };
}
