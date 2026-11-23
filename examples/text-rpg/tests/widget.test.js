import test from 'node:test';
import assert from 'node:assert/strict';
import { renderNewCharacter } from '../src/widget/new-character.js';
import { textRpgModule } from '../src/module.js';
import { flush, mount } from './helpers/fake-dom.js';
import { newHost, astraOf } from './helpers/host.js';

const set = (el, role, value) => {
    const input = el.find(['data-role', role]);
    input.value = String(value);
    return input.dispatch('input');
};

test('the form starts at 60 points placed, names what is left, and enables Create only with a name and 60', async () => {
    const el = mount();
    renderNewCharacter(el, {}, { command: async () => ({ ok: true }) });
    const create = el.find(['data-act', 'create']);
    assert.equal(el.find(['data-role', 'left']).textContent, 'All 60 points placed.');
    assert.equal(create.disabled, true, 'no name yet');
    await set(el, 'name', 'Astra');
    assert.equal(create.disabled, false);
    await set(el, 'stat-str', 12);
    assert.equal(el.find(['data-role', 'left']).textContent, '3 points too many.');
    assert.equal(create.disabled, true);
    await set(el, 'stat-str', 8);
    assert.equal(el.find(['data-role', 'left']).textContent, '1 point left to place.');
});

test('each stat is held to 5..15: 60 points with a stat of 30 or of 4 leaves Create disabled', async () => {
    const el = mount();
    renderNewCharacter(el, {}, { command: async () => ({ ok: true }) });
    const create = el.find(['data-act', 'create']);
    await set(el, 'name', 'Astra');
    assert.equal(el.find(['data-role', 'stat-str']).getAttribute('min'), '5');
    assert.equal(el.find(['data-role', 'stat-str']).getAttribute('max'), '15');
    for (const key of ['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha']) await set(el, `stat-${key}`, key === 'str' ? 30 : 5);
    assert.equal(el.find(['data-role', 'left']).textContent, 'All 60 points placed.');
    assert.equal(create.disabled, true, '5 × 6 + 30 adds up to 60 but 30 is past 15');
    for (const [key, value] of [['str', 15], ['vit', 15], ['agi', 15], ['dex', 15], ['int', 0], ['wis', 0], ['cha', 0]]) await set(el, `stat-${key}`, value);
    assert.equal(create.disabled, true, 'a stat of 0 is under 5 even when the total is 60');
    for (const [key, value] of [['str', 15], ['vit', 15], ['agi', 10], ['dex', 5], ['int', 5], ['wis', 5], ['cha', 5]]) await set(el, `stat-${key}`, value);
    assert.equal(create.disabled, false);
    // Leaving a field brings a stat back into 5..15.
    for (const [value, held] of [[30, '15'], [2, '5'], [9, '9']]) {
        const input = el.find(['data-role', 'stat-wis']);
        input.value = String(value);
        await input.dispatch('change');
        assert.equal(input.value, held);
    }
});

test('Create sends textRpg.create with the name, the stats and the named skills only', async () => {
    const calls = [];
    const el = mount();
    renderNewCharacter(el, {}, { command: async (type, payload) => (calls.push([type, payload]), { ok: true }) });
    await set(el, 'name', ' Astra ');
    await set(el, 'skill-0', 'Obscure');
    await set(el, 'skill-stat-0', 'AGI');
    await set(el, 'skill-about-0', 'melts into shadow');
    await el.find(['data-act', 'create']).click();
    await flush();
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'textRpg.create');
    assert.deepEqual(calls[0][1], { name: 'Astra', stats: { str: 9, vit: 9, agi: 9, dex: 9, int: 8, wis: 8, cha: 8 }, skills: [{ name: 'Obscure', stat: 'agi', about: 'melts into shadow' }] });
    assert.equal(el.find(['data-role', 'message']).textContent, 'Astra begins the story.');
});

test('a refusal is shown as the command said it', async () => {
    const el = mount();
    renderNewCharacter(el, {}, { command: async () => ({ ok: false, message: 'There is a character already.' }) });
    await set(el, 'name', 'A');
    await el.find(['data-act', 'create']).click();
    await flush();
    assert.equal(el.find(['data-role', 'message']).textContent, 'There is a character already.');
});

test('the widget and its screen are registered, the screen names the widget, and the widget makes the character through the host', async t => {
    t.mock.method(console, 'warn', () => {});
    const def = textRpgModule(null);
    assert.deepEqual(def.screens.map(screen => screen.id), ['text-rpg/new-character']);
    assert.match(def.screens[0].template, /ss-widget name="text-rpg\.new-character"/);
    const host = await newHost();
    try {
        const el = mount();
        const live = textRpgModule({ command: (...args) => host.sdk.command(...args) });
        live.widgets['text-rpg.new-character'].render(el, {}, {});
        await set(el, 'name', 'Astra');
        await el.find(['data-act', 'create']).click();
        await flush();
        assert.equal(astraOf(host).name, 'Astra');
        assert.equal(host.sdk.query('textRpg.view').pcId, astraOf(host).id);
    } finally {
        host.close();
    }
});
