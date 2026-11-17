import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePack } from '../../packs/validate.js';
import { CHOOSER_TEMPLATES as STANDARD_TEMPLATES, grownSkills } from '../../modules/rpg/templates.js';
import { readParty } from '../../modules/rpg/view/party-data.js';
import { summaryOf } from '../../modules/data-modules/part.js';
import { setupDom } from '../ui/view/mounts/helpers.js';
import { fakeState } from '../modules/rpg/view/helpers.js';
import { renderSkills, slotsShown } from '../../modules/rpg/view/skills.js';
import { joinCard, joinDraft, joinOffers } from '../../modules/rpg/join.js';
import { buildDefinitions, readDraft } from '../../modules/rpg/view/wizard-data.js';
import { skip, reply, SKILLS, person, world, fieldsOf, receipts, joinReceipt, told, update, bytes, mine } from './cast-skills.helpers.js';

test('replay equals live: rebuild, reload, Re-read, swipe and delete of a join, also after the pack was updated', { skip }, async t => {
    const host = await world(t);
    await host.send('Mara walks in.', reply('+ party Mara'));
    const live = bytes(host);
    host.store.rebuild();
    assert.equal(bytes(host), live, 'a rebuild equals live');
    await host.st.loadChat(JSON.parse(JSON.stringify(host.ctx.chat)));
    assert.equal(bytes(host), live, 'a reload equals live');
    // the author changes every skill; the old join must not
    await update(host, [person({ skills: [{ name: 'Brand New', about: 'Different.', stat: 'luk', rank: 'master' }] })]);
    host.store.rebuild();
    assert.equal(bytes(host), live, 'a rebuild after the update equals live');
    assert.equal((await host.turn.reread(host.ctx.chat.length - 1)).ok, true);
    assert.equal(bytes(host), live, 'a Re-read after the update seeds what the reply seeded, not the new pack');
    await host.swipe(reply('Nobody after all.', '+ coin 1'));
    assert.equal(fieldsOf(host, 'mara-skills'), undefined, 'a swipe takes the join and its skills away together');
    await host.send('Mara again.', reply('+ party Mara'));
    assert.deepEqual(mine(fieldsOf(host, 'mara-skills')).map(row => row[1]), ['Brand New'], 'a new join reads the pack as it is');
    await host.st.deleteMessage(host.ctx.chat.length - 1);
    assert.equal(fieldsOf(host, 'mara-skills'), undefined);
    assert.deepEqual(host.store.problems(), []);
});

// ---- the Skills view --------------------------------------------------------------------------------------------------------------------

const template = role => structuredClone(STANDARD_TEMPLATES.find(entry => entry.definition.role === role).definition);
function drawSkills(level, fields) {
    const doc = setupDom(), el = doc.createElement('div');
    doc.body.appendChild(el);
    const character = { definition: template('character'), fields: { who: 'Harrak', str: 14, vit: 12, agi: 11, dex: 10, int: 8, luk: 9, cha: 10, level } };
    const person = readParty(fakeState([character, { definition: template('skills'), fields: { who: 'Harrak', ...fields } }]), { own: 'Harrak' })[0];
    renderSkills(el, { character: person, api: {}, onBack: () => {} });
    return { el, person };
}
const SIG = { skill1: 'Beacon Call', about1: 'The horn.', stat1: 'cha', uses1: 'stamina', rank1: 1, skill2: 'Own Trick', about2: 'Mine.', stat2: 'dex', uses2: 'stamina', rank2: 0, sig: 1 };

test('the Skills view marks a signature skill with a lock after the rank pill, a legend entry and a foot-note sentence; only that skill', () => {
    const { el } = drawSkills(56, SIG);
    const cards = el.querySelectorAll('.rpg-skill');
    assert.equal(cards[0].querySelectorAll('.rpg-skill-lock').length, 1);
    assert.equal(cards[0].querySelector('.rpg-skill-lock').getAttribute('title'), 'Signature skill, from the pack');
    const top = [...cards[0].querySelector('.rpg-skill-top').children].map(node => node.className);
    assert.ok(top.findIndex(name => name.includes('rpg-rank')) + 1 === top.findIndex(name => name.includes('rpg-skill-lock')), 'right after the rank pill');
    assert.equal(cards[1].querySelectorAll('.rpg-skill-lock').length, 0, 'her own skill has none');
    assert.match(el.querySelector('.rpg-skill-legend').textContent, /Signature: from the pack, kept as written/);
    assert.match(el.querySelector('.rpg-skill-note').textContent, /signature skill came with the person from the pack/);
    const plain = drawSkills(56, { ...SIG, sig: 0 }).el;
    assert.equal(plain.querySelectorAll('.rpg-skill-lock').length, 0);
    assert.doesNotMatch(plain.querySelector('.rpg-skill-legend').textContent, /Signature/);
    assert.doesNotMatch(plain.querySelector('.rpg-skill-note').textContent, /signature/);
});

// ---- the extra slots --------------------------------------------------------------------------------------------------------------------

const SIX = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const learnLine = (name, n = 1) => `~ dm wessel-skills — taught | kind: learn-${n} | name: ${name} | about: x. | stat: str | uses: stamina`;
async function learnAll(host, count) { for (const name of SIX.slice(0, count)) await host.send('Learn.', reply(learnLine(name))); }

// ---- Skills blocks made before the extra slots ------------------------------------------------------------------------------------------

// A Skills block as 2.20 made it: five slots, no signature mark.
function oldSkills(slug, who) {
    const definition = template('skills');
    for (const key of Object.keys(definition.state)) if (/(\D)(6|7|8)$/u.test(key) || key === 'sig') delete definition.state[key];
    for (const key of Object.keys(definition.kinds)) if (/-(6|7|8)$/u.test(key)) delete definition.kinds[key];
    definition.rules = definition.rules.filter(rule => !/-(6|7|8)$/u.test(rule.id));
    definition.slug = slug; definition.name = `${who} skills`; definition.state.who.default = who;
    return definition;
}
async function oldWorld(t, opts) {
    const host = await world(t, opts);
    const character = template('character');
    character.slug = 'mara'; character.name = 'Mara'; character.state.who.default = 'Mara';
    assert.equal((await host.sdk.command('dm.define', { definition: character })).ok, true);
    assert.equal((await host.sdk.command('dm.define', { definition: oldSkills('mara-skills', 'Mara') })).ok, true);
    return host;
}
const hashOfBlock = (host, slug) => host.head().domains.dataModules.active[`pack.chat/${slug}`].hash;
const fieldCount = (host, slug) => Object.keys(host.head().domains.dataModules.pins[hashOfBlock(host, slug)].definition.state).length;
const LEARN = (slug, name) => `~ dm ${slug} — taught | kind: learn-1 | name: ${name} | about: x. | stat: str | uses: stamina`;

// ---- Edit first --------------------------------------------------------------------------------------------------------------------------

test('Edit first carries the signature skills: the offer records them, the card\'s payload has them and the wizard draft marks them', { skip }, async t => {
    const host = await world(t, { join: 'ask' });
    await host.send('Mara waits.', reply('+ party Mara | about: a ferrywoman'));
    const offer = receipts(host).find(entry => entry.data?.join?.op === 'offer').data.join;
    assert.deepEqual(offer.skills.map(skill => skill.name), ['Tide Step', 'Ferry Spark', 'Rope Haul']);
    const entries = [{ index: host.ctx.chat.length - 1, receipt: { data: { join: offer } } }];
    const card = joinCard(joinOffers(entries, host.ctx.chat.length - 1, []));
    const edit = card.actions.find(action => action.id === 'edit');
    assert.deepEqual(edit.payload.skills.map(skill => skill.rank), [2, 0, 3]);
    const draft = joinDraft(edit.payload);
    assert.deepEqual(draft.skills.map(skill => [skill.name, skill.rank, skill.sig]), [['Tide Step', 2, true], ['Ferry Spark', 0, true], ['Rope Haul', 3, true]]);
    const made = buildDefinitions(draft, {});
    assert.equal(made.skills.state.sig.default, 7);
    assert.deepEqual([made.skills.state.rank1.default, made.skills.state.rank3.default, made.skills.state.skill2.default], [2, 3, 'Ferry Spark']);
    assert.deepEqual(readDraft(draft), draft, 'a draft read again is the same');
    // an offer with no skills has a payload as before
    assert.equal('skills' in joinCard(joinOffers([{ index: 1, receipt: { data: { join: { op: 'offer', name: 'Pip', about: '', soul: 1, best: '' } } } }], 1, [])).actions[1].payload, false);
});

// ---- Ersveil ----------------------------------------------------------------------------------------------------------------------------

test('Ersveil gives each of its 12 cast members exactly 2 skills (owner list, 10 Nov), and the pack still checks', () => {
    const raw = readFileSync(new URL('../../examples/packs/ersveil/pack.json', import.meta.url), 'utf8');
    const result = validatePack(raw);
    assert.equal(result.ok, true, JSON.stringify(result.errors?.slice(0, 3)));
    const cast = result.pack.content.cast;
    assert.equal(cast.length, 12);
    for (const member of cast) assert.equal(member.skills.length, 2, member.name);
    const level = person => Number(person.fields?.Level);
    const rank = member => member.skills.map(skill => ['novice', 'adept', 'expert', 'master'].indexOf(skill.rank));
    const low = cast.find(member => level(member) === 4), high = cast.find(member => level(member) === 56);
    assert.equal(low.name, 'Sister Temiwa');
    assert.deepEqual(rank(low), [0, 0], 'Lv 4: both Novice');
    assert.equal(high.name, 'Harrak');
    assert.deepEqual(rank(high), [2, 3], 'Lv 56: Expert and Master');
});
