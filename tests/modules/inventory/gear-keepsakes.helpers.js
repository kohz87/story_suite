// Gives people an NPC State record whose Keepsakes name pack equipment: the one way a join brings gear (pack format 4). Used by the gear join tests.
import assert from 'node:assert/strict';

/** `list`: `[{ id, name, aliases?, gear?: [item names] }]`. Writes them on the chat's newest message; call it after the first `host.send`. */
export async function writeKeepsakes(host, list) {
    const source = host.store.sourceAt(host.store.headIndex());
    const npcs = Object.fromEntries(list.map(person => [person.id, {
        id: person.id, name: person.name, aliases: person.aliases ?? [], role: 'Ferry hand',
        keepsakes: (person.gear ?? []).map(name => ({ name, description: `Their ${name}.` })),
    }]));
    const view = { v: 1, order: list.map(person => person.id), npcs, candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {} };
    assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: source.sid, swipeKey: source.swipeKey }, view })).ok, true);
}
