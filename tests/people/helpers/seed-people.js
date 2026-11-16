// Puts a test host's dossiers in the store's people domain, as NPC State's own write would after a reply (people store P4: npc.cast lists the store's
// people). `records`: the fake runtime's dossiers ({ [id]: record } or a list). Tests only.
import { peopleView } from '../../src/people/view.js';

/**
 * A state without the stored dossiers (`domains.people.npcs`): since P2 NPC State's people.write keeps whole dossiers in the store (a note's text included,
 * as in its sidecar before), so a "the text is nowhere in the state" check is about everything else: the meters (bonds), other domains, receipts.
 */
export function withoutDossiers(state) {
    const copy = structuredClone(state);
    if (copy?.domains?.people) delete copy.domains.people.npcs;
    return copy;
}

/** Writes `records` as the people of the head's reply through people.write; throws when the host refuses. */
export async function seedPeople(sdk, store, records) {
    const npcs = (Array.isArray(records) ? records : Object.values(records ?? {})).map(record => structuredClone(record));
    const source = store.sourceAt(store.headIndex());
    const view = peopleView({ npcs, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {}, turn: 0 });
    const out = await sdk.command('people.write', { v: 1, source: { sid: source?.sid, swipeKey: source?.swipeKey }, view });
    if (out?.ok !== true) throw new Error(`seedPeople: ${out?.code} ${out?.message}`);
    return out;
}
