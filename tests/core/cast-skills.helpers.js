import assert from 'node:assert/strict';
import { createHost, hostAvailable } from '../../testkit/index.js';
import { validatePack } from '../../packs/validate.js';
import { STANDARD_TEMPLATES_EIGHT as STANDARD_TEMPLATES } from '../../modules/rpg/templates.js';
import { pack } from '../packs/helpers/fixtures.js';

export const available = await hostAvailable();
export const skip = available.ok ? false : available.reason;
export const reply = (...lines) => `The tide turns.\n<Changes>\n${lines.join('\n')}\n</Changes>`;

export const SKILLS = [
    { name: 'Tide Step', about: 'Light footwork on a rocking deck.', stat: 'agi', rank: 'adept' },
    { name: 'Ferry Spark', about: 'A small lantern-flash of magic.', stat: 'int', uses: 'mana' },
    { name: 'Rope Haul', about: 'Hauls a line hand over hand.', stat: 'str', uses: 'stamina', rank: 'expert' },
];
export const person = (extra = {}) => ({ id: 'mara', name: 'Mara', aliases: ['the ferrywoman'], about: 'Runs the night ferry.', look: 'Wiry.', start: { place: 'Docks', goal: 'Keep the ferry running.' }, ...extra });
export const withCast = list => pack({ content: { cast: list } });
export const refused = (list, path) => {
    const result = validatePack(JSON.stringify(withCast(list)));
    assert.equal(result.ok, false, `${path} should be refused`);
    const hit = result.errors.find(error => error.path === path);
    assert.ok(hit, `no error at ${path}: ${JSON.stringify(result.errors)}`);
    assert.ok(hit.message.length > 20, 'a sentence the author can act on');
    return hit;
};

export async function world(t, { list = [person({ skills: SKILLS })], rpg = true, join = 'auto' } = {}) {
    t.mock.method(console, 'warn', () => {});
    const raw = withCast(list);
    const built = validatePack(raw);
    assert.equal(built.ok, true, JSON.stringify(built.errors));
    const host = await createHost({
        settings: { features: rpg ? { 'story-block.rpg': true } : {}, modules: { 'story-block': { rpgJoin: join, rpgFormula: 'classic', rpgRolls: 'off', rpgChecks: false } },
            packs: [{ id: built.pack.id, version: built.pack.version, enabled: true, source: 'file', origin: 'test', pack: raw }] },
    });
    t.after(() => host.close());
    await host.send('Begin.', 'Opening.');
    const defs = Object.fromEntries(STANDARD_TEMPLATES.filter(entry => ['character', 'skills'].includes(entry.definition.role)).map(entry => [entry.definition.role, structuredClone(entry.definition)]));
    defs.character.slug = 'wessel'; defs.character.name = 'Wessel'; defs.character.state.who.default = 'Wessel';
    defs.skills.slug = 'wessel-skills'; defs.skills.name = 'Wessel skills'; defs.skills.state.who.default = 'Wessel';
    for (const definition of [defs.character, defs.skills]) assert.equal((await host.sdk.command('dm.define', { definition })).ok, true);
    return host;
}
export const fieldsOf = (host, slug) => host.head().domains.dataModules.instances[`pack.chat/${slug}`]?.chat.fields;
export const receipts = host => host.ctx.chat.at(-1).extra.storySuite.receipts;
export const joinReceipt = host => receipts(host).find(entry => entry.type === 'capture.party');
export const told = host => host.turn.problems().filter(problem => problem.code !== 'DICE_SKIPPED').map(problem => problem.message);
export const update = async (host, list) => {
    const raw = withCast(list);
    const out = await host.packs.packs.install(raw);
    assert.equal(out.ok, true, JSON.stringify(out.errors));
};
export const bytes = host => JSON.stringify([Object.entries(host.head().domains.dataModules.instances).map(([id, instance]) => [id, instance.chat?.fields]),
    host.ctx.chat.map(message => (message.extra?.storySuite?.receipts ?? []).map(r => [r.type, r.summary, r.data?.sigSkills, r.data?.join]))]);
export const mine = fields => [1, 2, 3, 4, 5, 6, 7, 8].filter(n => fields[`skill${n}`]).map(n => [n, fields[`skill${n}`], fields[`stat${n}`], fields[`uses${n}`], fields[`rank${n}`], fields[`practice${n}`]]);
