// A host whose people have NPC State records (pack format 4): a join builds the sheet from the record's abilities (the pull), the one way a person comes with skills.
import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../modules/rpg/templates.js';

export const MARA_RECORD = {
    id: 'npc_mara', name: 'Mara', aliases: ['the ferrywoman'], role: 'Ferry healer', level: 12,
    abilities: [{ name: 'Mend', description: 'binds a wound shut' }, { name: 'Lantern Ward', description: 'a shield of light' }, { name: 'Ferry Lore', description: 'knows every channel' }],
    keepsakes: [],
};

/** Wessel is in the party; `list` records are written on the first message. `records: []` gives a chat where nobody has a record. */
export async function pullWorld(t, { records = [MARA_RECORD], rpg = true, join = 'auto' } = {}) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings: { features: rpg ? { 'story-block.rpg': true } : {}, modules: { 'story-block': { rpgJoin: join, rpgFormula: 'classic', rpgRolls: 'off', rpgChecks: false } } } });
    t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    const source = host.store.sourceAt(host.store.headIndex());
    const view = { v: 1, order: records.map(record => record.id), npcs: Object.fromEntries(records.map(record => [record.id, record])), candidates: [], dismissed: [], userDismissedGroups: [], socialGraph: {}, portraitAssets: {} };
    assert.equal((await host.sdk.command('people.write', { v: 1, source: { sid: source.sid, swipeKey: source.swipeKey }, view })).ok, true);
    const defs = Object.fromEntries(STANDARD_TEMPLATES.filter(entry => ['character', 'skills'].includes(entry.definition.role)).map(entry => [entry.definition.role, structuredClone(entry.definition)]));
    defs.character.slug = 'wessel'; defs.character.name = 'Wessel'; defs.character.state.who.default = 'Wessel';
    defs.skills.slug = 'wessel-skills'; defs.skills.name = 'Wessel skills'; defs.skills.state.who.default = 'Wessel';
    for (const definition of [defs.character, defs.skills]) assert.equal((await host.sdk.command('dm.define', { definition })).ok, true);
    return host;
}
