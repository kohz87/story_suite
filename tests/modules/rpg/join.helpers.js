// Shared fixtures and helpers for the join test suite.
import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../../testkit/index.js';
import { levelOfClass } from '../../../modules/rpg/formula.js';
import { CORE_FEATURE } from '../../../core/features.js';
import { PARTY_MAX } from '../../../modules/rpg/names.js';
import { partyOf } from '../../../modules/rpg/join.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES } from '../../../modules/rpg/templates.js';

export const available = await hostAvailable();
export const skip = available.ok ? false : available.reason;
export const MARA = '+ party Mara | about: a hedge-witch from Kvildal | class: IV | best: int';
export const reply = (...lines) => `The tide turns.\n<Changes>\n${lines.join('\n')}\n</Changes>`;

// A host with the RPG on and Wessel (Soul Class III) already in the party, made from the real templates.
// `eight`: every reply is captured with the `partyRoom` mark only (the party limit of 8), as replies written before `partyFour` were.
export async function world({ mode = 'auto', feature = true, wessel = true, eight = false } = {}) {
    const host = await createHost({ settings: { modules: { 'story-block': { rpgJoin: mode } } } });
    if (eight) { const marks = host.store.setRuleMarks; host.store.setRuleMarks = (index, names) => { names.splice(names.indexOf('partyFour'), 1); return marks(index, names); }; }
    if (feature) host.features.set(CORE_FEATURE.leanRpg, true);
    await host.send('Begin.', 'Opening.');
    if (wessel) await make(host, 'Wessel', 3);
    return host;
}
export async function make(host, who, soul = 1) {
    const defs = Object.fromEntries(STANDARD_TEMPLATES.filter(entry => ['character', 'skills'].includes(entry.definition.role)).map(entry => [entry.definition.role, structuredClone(entry.definition)]));
    defs.character.slug = who.toLowerCase(); defs.character.name = who; defs.character.state.who.default = who; defs.character.state.level.default = levelOfClass(soul);
    defs.skills.slug = `${who.toLowerCase()}-skills`; defs.skills.name = `${who}'s skills`; defs.skills.state.who.default = who;
    assert.equal((await host.sdk.command('dm.define', { definition: defs.character })).ok, true);
    // (as the wizard does: the Skills block follows its Character, so it replays only with it)
    assert.equal((await host.sdk.command('dm.define', { definition: defs.skills, after: `pack.chat/${defs.character.slug}` })).ok, true);
}
export const blocks = host => Object.keys(host.head().domains.dataModules?.active ?? {}).sort();
export const fields = (host, slug) => host.sdk.query('dataModules.view', { module: `pack.chat/${slug}` })?.chat;
export const problems = host => host.turn.problems().filter(item => !['ROLLS_SKIPPED', 'DICE_SKIPPED'].includes(item.code)).map(item => item.message);
export const statics = host => host.registry.contexts().map(context => context.static ?? '').join('\n');
export const grammar = host => host.registry.contexts().flatMap(context => context.kinds).filter(entry => entry.kind === 'party').map(entry => entry.grammar);
export const lastReceipts = host => host.ctx.chat.at(-1).extra.storySuite.receipts;
export async function rebuilt(host, label) {
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live, `${label}: a rebuild gives the live story`);
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(JSON.stringify(host.head()), live, `${label}: a reload gives the live story`);
    assert.deepEqual(host.store.problems(), [], `${label}: nothing left inactive`);
}

// Eight active (Wessel and seven companions) with the replies that follow: each marked join and return records the party it relied on.
export const active = host => partyOf(host.head()).filter(person => !person.left).length;
// (`size` 4: the reader's own actions keep the limit of 4, so their tests use a full party of four; 8: replies captured with only the `partyRoom` mark)
export async function packed(size = 8) {
    const host = await world({ eight: size === 8 });
    for (const who of ['Mara', 'Ren', 'Ilse', 'Dov', 'Pip', 'Kit', 'Lou'].slice(0, size - 1)) await host.send(`${who} comes.`, reply(`+ party ${who}`));
    assert.equal(active(host), size);
    return host;
}
export const lastAt = host => host.ctx.chat.length - 1;
export async function settled(host, label) {
    const live = JSON.stringify(host.head());
    host.store.rebuild();
    assert.equal(JSON.stringify(host.head()), live, `${label}: a rebuild gives the live story`);
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(JSON.stringify(host.head()), live, `${label}: a reload gives the live story`);
    assert.equal(active(host) <= PARTY_MAX, true, `${label}: never more than ${PARTY_MAX} active`);
}

// Four active (the reader's own limit) with Ask on: the companions are made as the wizard and template make them (dm.define), the reader's Add to party is dm.join.
export async function packedAsk(size = 4) {
    const host = await world({ mode: 'ask', eight: size === 8 });
    for (const who of ['Mara', 'Ren', 'Ilse', 'Dov', 'Pip', 'Kit', 'Lou'].slice(0, size - 1)) await make(host, who);
    assert.equal(active(host), size);
    return host;
}
export const templateCharacter = () => {
    const definition = structuredClone(STANDARD_TEMPLATES.find(entry => entry.definition.role === 'character').definition);
    delete definition.id; delete definition.pack;
    return Object.assign(definition, { slug: 'template-hero', name: 'Template hero' });
};

export function prng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export const NAMES = ['Mara', 'Ilse', 'Dov', 'Pip', 'Wessel'];

export const TORKA = '+ party Torka Bloodsong | about: an orc with an axe | class: II | best: str';
// Wessel (the reader's, the first block) and three companions: four active under the `partyFour` mark.
export async function four({ mode = 'auto' } = {}) {
    const host = await world({ mode });
    for (const who of ['Mara', 'Ren', 'Ilse']) await host.send(`${who} comes.`, reply(`+ party ${who}`));
    assert.equal(active(host), 4);
    return host;
}
export const joinCardOf = host => host.registry.cardEntries().find(entry => entry.id === 'story-block/rpg-join').fn(host.head(), null, { index: host.ctx.chat.length - 1, head: true, query: (name, args) => host.sdk.query(name, args) });
export const names = host => partyOf(host.head()).filter(person => !person.left).map(person => person.name);
