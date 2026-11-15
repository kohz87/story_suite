// Story Director v2, names: `apply` for `person` lines: check the name, store the person, refuse with a Problem and cue.

import { personMatches } from '../../../tracker-words.js';
import { checkName } from './check.js';
import { cleanName } from './text.js';
import { nameKey, bareKey } from './keys.js';
import { parseProfile, capMinor } from './profile.js';
import { MAX_TAKEN } from './slice-limits.js';
import { tables, revOf } from './slice-keys.js';
import { jsonKey, oldest } from './slice-edit.js';
import { settingsOf, packNames } from './feature.js';
import { isRecord, queryOf } from './host-read.js';

const reasonText = reason => (reason.kind === 'banned' ? 'it is on the banned list' : reason.kind === 'overused' ? 'models overuse that name' : reason.kind === 'taken' ? 'it is already used' : reason.kind === 'first' ? 'its first name is already used' : 'it is one letter from a name in use');

/** `apply` for `person` lines: the check, the stored person (name and one-line profile, frozen), and the Problem and cue on a refusal. */
export function applyPerson(ctx, line) {
    const name = cleanName(line?.name);
    const key = nameKey(name);
    if (line?.op !== '+' || !key) return ctx.fail('INVALID', `"${line?.op ?? ''} person ${name}": a person line is "+ person Name | look: … | flaw: … | voice: … | temper: …".`);
    const slice = ctx.draft('names');
    const { people, seen, taken } = tables(slice);
    const settings = settingsOf(ctx);
    const packed = packNames(queryOf(ctx));
    const others = [...Object.values(people), ...Object.values(seen)];
    // A unique full, partial, titled or alias match is the same person. Multiple candidates are a collision.
    const matches = personMatches(name, others, bareKey);
    if (matches === 1) return { summary: `Name: ${name} is known already.`, narrate: false, data: { person: key, known: true } };
    const known = others.flatMap(entry => [entry.name, ...(entry.aliases ?? [])]).map(name => ({ name, by: 'used' }));
    const { reasons } = checkName(name, { known, banned: [...settings.banned, ...(packed?.banned ?? [])] });
    if (matches > 1 && !reasons.some(reason => reason.kind === 'taken')) reasons.push({ kind: 'taken', by: 'used' });
    const read = parseProfile([line?.text, ...Object.entries(isRecord(line?.labels) ? line.labels : {}).map(([label, value]) => `${label}: ${value}`)].filter(Boolean).join(' | '));
    if (!reasons.length) {
        people[key] = { name, first: revOf(ctx), profile: read.ok ? read.profile : null, rev: revOf(ctx) };
        for (const evicted of capMinor(people).evicted) delete people[evicted];
        delete seen[key];
        return { summary: `Name: ${name} is new${read.ok ? `; ${read.text}` : ''}.`, narrate: false, data: { person: key } };
    }
    const why = reasons.map(reasonText).join('; ');
    if (reasons.some(reason => reason.kind !== 'near')) {
        if (Object.hasOwn(taken, key) && typeof ctx.ifThere === 'function') ctx.ifThere('names', `/taken/${jsonKey(key)}`);
        delete taken[key];
        taken[key] = { name, rev: revOf(ctx), told: false };
        oldest(taken, MAX_TAKEN);
    }
    return { summary: `Name: ${name} is not a fresh name (${why}).`, narrate: false, data: { person: key, taken: true }, problem: `${name}: ${why}. ${reasons.every(reason => reason.kind === 'near') ? 'Check it is not the same person under another spelling.' : 'The next reply asks the narrator for another name (or swipe).'}` };
}
