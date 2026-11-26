// Who a name means for the holding's posts, on a hand-built state: the post check's wider party match, and two unjoined records of one name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { postProblem } from '../../../modules/data-modules/holding/stays.js';
import { isDead, samePerson, travels } from '../../../modules/data-modules/holding/person.js';
import { CHOOSER_TEMPLATES } from '../../../modules/rpg/templates.js';

const pack = JSON.parse(readFileSync(new URL('../../../examples/packs/ersveil-game/pack.json', import.meta.url), 'utf8'));
const holding = pack.content.dataModules.find(definition => definition.slug === 'holding');

// A party of one sheet, `who`, who never left, and these NPC State dossiers.
function state(who, npcs) {
    const definition = structuredClone(CHOOSER_TEMPLATES.find(entry => entry.definition.role === 'character').definition);
    const fields = Object.fromEntries(Object.entries(definition.state).map(([key, field]) => [key, structuredClone(field.default)]));
    fields.who = who;
    const dataModules = {
        pins: { sheet: { interpreter: 1, definition: { schema: 1, ...definition } }, holding: { interpreter: 1, definition: holding } },
        active: { 'pack.chat/sheet': { hash: 'sheet' }, 'pack.ersveil-game/holding': { hash: 'holding' } },
        instances: { 'pack.chat/sheet': { chat: { fields } } },
    };
    return { domains: { dataModules, people: { npcs }, cast: { people: {} } } };
}

// The post check for `name`, who is in the scene at the seat.
function post(prefix, name) {
    const answers = { 'people.list': Object.values(prefix.domains.people.npcs), 'scene.present': [name], 'scene.place': { name: 'Ravenhold' } };
    const ctx = { query: query => answers[query] ?? null, read: domain => prefix.domains[domain] };
    return postProblem(ctx, prefix, { seat: 'Ravenhold', steward: '' }, { post: 'steward', person: name }, () => false);
}

test('a travelling companion whose dossier has a longer name and no short alias cannot take a post; the strict match is unchanged', () => {
    const prefix = state('Ren', { ren: { name: 'Ren Ashby', aliases: [] } });
    assert.deepEqual(post(prefix, 'Ren Ashby'), { why: 'Ren Ashby travels with You; only someone who stays at the seat can hold a post' });
    assert.equal(travels(prefix, 'Ren Ashby'), false, 'a rejoin or a death is judged strictly');
});

test('a travelling companion with their own record does not keep another person of that first name from a post', () => {
    const prefix = state('Mara', { one: { name: 'Mara', aliases: [] }, two: { name: 'Mara Vell', aliases: [] } });
    assert.deepEqual(post(prefix, 'Mara Vell'), { who: 'Mara Vell' });
});

const met = (name, extra) => ({ name, met: { day: 1 }, alive: true, ...extra });

test('one unjoined dossier and one unjoined cast record of one name are one person, dead if either says so', () => {
    for (const [dossier, record] of [[{ lifeState: 'deceased' }, {}], [{}, { alive: false }]]) {
        const prefix = state('Hero', { x: { name: 'Ilse', aliases: ['the Reeve'], ...dossier } });
        prefix.domains.cast.people = { ilse: met('Ilse', { aliases: ['Old Ilse'], ...record }) };
        assert.equal(isDead(prefix, 'Ilse'), true);
        assert.equal(isDead(prefix, 'Old Ilse'), true);
        assert.equal(samePerson(prefix, 'the Reeve', 'Old Ilse'), true);
    }
});

test('two dossiers of one name are not guessed to be the cast record', () => {
    const prefix = state('Hero', { x: { name: 'Ilse', aliases: [], lifeState: 'deceased' }, y: { name: 'Ilse', aliases: [] } });
    prefix.domains.cast.people = { ilse: met('Ilse', { aliases: ['Old Ilse'] }) };
    assert.equal(isDead(prefix, 'Ilse'), false);
    assert.equal(samePerson(prefix, 'Ilse', 'Old Ilse'), false);
});
