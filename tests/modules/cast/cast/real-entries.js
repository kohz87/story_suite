// The twelve Ersveil cast entries (tests/fixtures/director/ersveil-cast.json, written in the old cast shape) as a format 4 world pack takes them: the custom `fields`
// are not a world cast field, a stage has no `id` and needs a `text`, and a secret that opens "when" something is said in words has no format 4 twin (a gate is a meter or stage test or a
// fact), so it opens on trust 70 here; everything else is the entry as it was.
import { readFileSync } from 'node:fs';

/** The entry as a world pack's cast can hold it. */
export function forWorldPack({ fields: _fields, stages, secrets, ...own }) {
    return { ...own, ...(secrets ? { secrets: secrets.map(({ when: _when, ...secret }) => (secret.meter ? secret : { ...secret, meter: 'trust', at: 70 })) } : {}), ...(stages ? { stages: stages.map(({ id: _id, name, needs, milestone }) => ({ name, needs, text: milestone, milestone })) } : {}) };
}

/** The fixture's entries, each with the pack they came from (`pack`, `packVersion`) as the packs list them. */
export const realEntries = () => JSON.parse(readFileSync(new URL('../../../fixtures/director/ersveil-cast.json', import.meta.url), 'utf8')).map(item => ({ pack: 'ersveil', packVersion: '2.2.1', ...item }));
