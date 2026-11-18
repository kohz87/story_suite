// The job: the checks on the cast that need every person known: ties and key relationships name cast ids, and secret gates read.
// A reference to a person who is written but was refused is dropped with a Problem and the referrer stays; a reference to an id written
// nowhere, or a gate that does not read, refuses that person alone (a Problem), and the rest are checked again.

import { checkGate } from './gate.js';
import { buildIndex } from './index.js';

function dropRefused(person, field, key, index, rawIds, warn, at) {
    const list = person[field] ?? [];
    const kept = list.filter((entry, n) => {
        const id = entry[key];
        if (index.person(id) || !rawIds.has(id)) return true;
        warn('UNKNOWN_REF', `${at(person)}.${field}[${n}]`, `Cast "${person.name}": ${field}[${n}] names "${id}", who was refused (see the cast Problems); the reference was dropped and ${person.name} stays.`);
        return false;
    });
    return kept.length === list.length ? person : { ...person, [field]: kept };
}

/**
 * `cast`: the shape-checked entries. `rawIds`: every id the raw list wrote. `base`: the index inputs without the cast.
 * Returns `{ cast, refused }`: the entries that hold, and the ids written but left out. `at(person)` → the content.cast path.
 */
export function crossCast(cast, rawIds, base, warn, at, collect) {
    let kept = cast;
    for (let round = 0; round < 8; round += 1) {
        const refusedNow = new Set([...rawIds].filter(id => !kept.some(person => person.id === id)));
        const index = buildIndex({ ...base, cast: kept, refused: refusedNow });
        kept = kept.map(person => dropRefused(dropRefused(person, 'ties', 'with', index, rawIds, warn, at), 'keyRelationships', 'id', index, rawIds, warn, at));
        const refused = new Map();
        for (const person of kept) {
            const problems = [];
            const say = (field, message) => problems.push([field, message]);
            for (const [n, tie] of (person.ties ?? []).entries()) if (!index.person(tie.with)) say(`ties[${n}].with`, `"${tie.with}" is not a cast id; ties.with names a cast entry by id.`);
            for (const [n, entry] of (person.keyRelationships ?? []).entries()) if (!index.person(entry.id)) say(`keyRelationships[${n}].id`, `"${entry.id}" is not a cast id; keyRelationships.id names a cast entry by id.`);
            for (const [n, secret] of (person.secrets ?? []).entries()) if (secret.gate !== undefined) checkGate(secret.gate, { index, say, ok: () => true, collect }, `secrets[${n}].gate`, person);
            if (problems.length) refused.set(person.id, problems);
        }
        if (!refused.size) return { cast: kept, refused: refusedNow };
        for (const [id, problems] of refused) {
            const person = kept.find(entry => entry.id === id);
            for (const [field, message] of problems) warn('UNKNOWN_REF', `${at(person)}.${field}`, `Cast "${person.name}" was refused, the rest of the cast still loads: ${message}`);
        }
        kept = kept.filter(person => !refused.has(person.id));
    }
    return { cast: kept, refused: new Set([...rawIds].filter(id => !kept.some(person => person.id === id))) };
}
