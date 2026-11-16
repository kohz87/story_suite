// J11 step 7: with the flag `suite.worldPeopleOwn` the World people widget draws NPC State's cards itself from its queries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPeopleWidget } from '../../../src/v2/world/index.js';
import { installFakeDom } from '../../ui-fake-dom.js';
import { squash } from './helpers.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const PORTRAIT = 'https://example.org/mira.png';

// NPC State's queries as stand-ins, over a mutable `people` ({ name: { id, role, mood, rank, aliases, portrait } }) and the key list.
function world(people, { keys = [], absent = false } = {}) {
    const listeners = new Set();
    const api = {
        asked: [],
        query(name, args) {
            api.asked.push(name);
            if (absent) throw new Error('no such query');
            const find = who => Object.keys(people).find(key => key === who || (people[key].aliases ?? []).includes(who));
            if (name === 'npc.present') return Object.keys(people);
            if (name === 'npc.dossier') return find(args.name) ? { name: find(args.name), id: people[find(args.name)].id, role: people[find(args.name)].role, mood: people[find(args.name)].mood, aliases: people[find(args.name)].aliases ?? [] } : null;
            if (name === 'npc.meters') return find(args.name) ? { rank: people[find(args.name)].rank } : null;
            if (name === 'npc.portrait') return find(args.name) ? people[find(args.name)].portrait ?? null : null;
            if (name === 'director.keyPeople') return keys.map(key => ({ name: key }));
            return null;
        },
        on: (name, fn) => { if (name === 'changed') listeners.add(fn); return () => listeners.delete(fn); },
        change: () => listeners.forEach(fn => fn({ keys: ['people'] })),
        listeners,
    };
    return api;
}

const VALUE = { nsd: true, people: [{ name: 'Mira', dossier: true, key: 'mira' }, { name: 'Kell', dossier: false, key: 'kell', thought: 'not again' }], chatter: [{ key: 'mira', name: 'Mira', text: 'the tide turns' }] };

function draw(api, { flag = true, value = VALUE, opened = [] } = {}) {
    const doc = installFakeDom();
    const el = doc.createElement('div');
    doc.body.appendChild(el);
    const widget = createPeopleWidget({ open: () => name => opened.push(name), cast: () => null, flag: () => flag });
    const view = widget.render(el, { value }, api);
    return { el, view, doc };
}
const rows = el => el.querySelectorAll('.npc-state-delta-present-cell');
const PEOPLE = () => ({ Mira: { id: 'np_1', role: 'Captain', mood: 'calm', rank: 'Friend', aliases: ['Cap'], portrait: PORTRAIT }, 'Old Tom': { id: 'np_2', role: '', mood: '', rank: '' } });

test('flag on: one card per present person in npc.present order, with portrait or initial, name, Key tag, stage, role · mood and the thought inside', () => {
    const { el } = draw(world(PEOPLE(), { keys: ['Cap'] }));
    const cells = rows(el);
    assert.deepEqual(cells.map(cell => cell.querySelector('.npc-state-delta-present-card-name').textContent), ['Mira', 'Old Tom']);
    assert.equal(cells[0].querySelector('img').getAttribute('src'), PORTRAIT);
    assert.equal(cells[1].querySelector('.npc-state-delta-present-card-placeholder').textContent, 'O');
    assert.equal(cells[0].querySelector('.npc-state-delta-key-tag').textContent, '★ Key', 'a key person by alias');
    assert.equal(cells[1].querySelector('.npc-state-delta-key-tag'), null);
    assert.equal(cells[0].querySelector('.npc-state-delta-present-card-stage').textContent, 'Friend');
    assert.equal(cells[0].querySelector('.npc-state-delta-present-card-role').textContent, 'Captain · calm');
    assert.equal(cells[1].querySelector('.npc-state-delta-present-card-role').textContent, 'Present NPC');
    assert.equal(squash(cells[0].querySelector('.wv-thought').textContent), 'the tide turns', 'the thought is inside the card (matched by name)');
    assert.deepEqual(el.querySelectorAll('.wv-chip').map(chip => squash(chip.textContent)), ['Kell'], 'no card for Kell: a chip');
    assert.equal(el.querySelector('.npc-state-delta-present-roster-head small').textContent, '2 shown');
});

test('flag on: a click on a card opens that dossier by name', () => {
    const opened = [];
    const { el } = draw(world(PEOPLE()), { opened });
    rows(el)[1].querySelector('button').click();
    assert.deepEqual(opened, ['Old Tom']);
});

test('flag off (the default): the queries are never asked and the page API alone draws; byte-identical to the old path', () => {
    const api = world(PEOPLE());
    const { el } = draw(api, { flag: false });
    assert.equal(api.asked.includes('npc.present'), false);
    assert.equal(rows(el).length, 0, 'no page API: no cards (the same as without NPC State)');
    const old = draw(world(PEOPLE()), { flag: false });
    assert.equal(el.innerHTML, old.el.innerHTML);
});

test('flag on, NPC State absent: no cards, no error, chips as without it', () => {
    const { el } = draw(world(PEOPLE(), { absent: true }));
    assert.equal(rows(el).length, 0);
    assert.deepEqual(el.querySelectorAll('.wv-chip').map(chip => squash(chip.textContent)), ['Mira', 'Kell']);
});

test('flag on: a changed event redraws once; grown, shrunk and a Re-read give what a fresh draw gives', async () => {
    const people = PEOPLE();
    const api = world(people);
    const { el } = draw(api);
    assert.equal(api.listeners.size, 1);
    for (const change of [() => { people.Kell = { id: 'np_3', role: 'Guard', rank: 'Wary' }; }, () => { delete people['Old Tom']; }, () => { people.Mira.role = 'Admiral'; }, () => { for (const key of Object.keys(people)) delete people[key]; }]) {
        change();
        api.change();
        api.change();
        await tick();
        assert.equal(el.innerHTML, draw(world(people)).el.innerHTML, 'live == a fresh draw');
    }
});

test('flag on: destroy lets go of the subscription', () => {
    const api = world(PEOPLE());
    const { view } = draw(api);
    view.destroy();
    assert.equal(api.listeners.size, 0);
});
