// The Who step as the RPG's: the name from the persona, the starting level (1 to the cap, with the points it gives), and "Start from a saved character" (an RPG file or Text RPG's own).
import test from 'node:test';
import assert from 'node:assert/strict';
import { flush } from './helpers/fake-dom.js';
import { BUY, astraOf, newHost } from './helpers/host.js';
import { wizardPage } from './helpers/wizard-page.js';
import { levelOf, pointsOf } from '../src/module-parts/standing.js';
import { effectiveStats } from '../src/module-parts/effective.js';

const next = page => page.press('[data-wiz="next"]');
const raise = (page, stat, n = 1) => { for (let at = 0; at < n; at += 1) page.press(`[data-plus="${stat}"]`); };
const left = page => page.q('.wz-left-pill').textContent;
const rpgFile = (extra = {}) => JSON.stringify({
    storySuiteCharacter: 1, level: 5, soul: 1, points: 3, stats: { str: 14, vit: 12, agi: 9, dex: 20, int: 3, wis: 8, cha: 7 },
    skills: [{ name: 'Iron Breath', about: 'a blast', stat: 'str', uses: 'stamina', rank: 2 }, { name: 'Gale', about: 'quick', stat: 'agi', uses: 'stamina', rank: 0, type: 'speed' },
      { name: 'Ward', about: 'a spark', stat: 'int', uses: 'mana', rank: 1, type: 'focus' }, { name: 'Lore', about: '', uses: 'mana', rank: 0, type: 'utility' }],
    items: [{ name: 'Torch', qty: 2, note: 'half burnt' }, { name: 'Rope', qty: 1, carry: 5 }], money: 120, ...extra,
});
const pick = (page, text, name = 'ren.character.json') => {
    const input = page.q('[data-wiz="import"] input');
    input.files = [{ name, size: text.length, text: async () => text }];
    input.dispatchEvent(new globalThis.Event('change'));
    return flush();
};
const queries = answers => (name, args) => (name in answers ? (typeof answers[name] === 'function' ? answers[name](args) : answers[name]) : null);

test('the name starts as the persona\'s (persona.name), the reader can change it, and a blank persona leaves it empty', () => {
    const page = wizardPage(undefined, { query: queries({ 'persona.name': '  Astra Vale ' }) });
    assert.equal(page.q('[data-wiz="name"]').value, 'Astra Vale');
    assert.equal(page.q('.wz-who b').textContent, 'Astra Vale');
    assert.equal(page.q('.wz-help').textContent, 'From your persona. You can change it here.');
    assert.equal(wizardPage(undefined, { query: queries({}) }).q('[data-wiz="name"]').value, '');
});

test('the starting level is 1 to the cap (the Rules page\'s, asked of textRpg.rules); a rank shows only when the RPG\'s rank query names one', () => {
    const asked = [];
    const rank = args => (asked.push(args.level), args.level >= 5 ? { name: 'E' } : null);
    const page = wizardPage(undefined, { query: queries({ 'textRpg.rules': { cap: 8, rate: 100 }, 'rpg.rank': rank }) });
    assert.equal(page.q('[data-wiz="level"]').getAttribute('max'), '8');
    assert.match(page.all('.wz-help')[1].textContent, /^1 to 8\. The Rules page sets the level cap \(default 99\)\.$/);
    page.type('[data-wiz="level"]', '30');
    assert.equal(page.q('[data-wiz="level"]').value, '8', 'held to the cap');
    assert.match(page.all('.wz-help')[1].textContent, /Rank E covers this level in this story pack\. /);
    assert.match(page.q('[data-wiz="start-note"]').textContent, /Starts at Lv 8 with 0 XP\./);
    page.type('[data-wiz="level"]', '2');
    assert.doesNotMatch(page.all('.wz-help')[1].textContent, /Rank/);
    assert.equal(page.q('.wz-who small').textContent, 'You · Lv 2');
});

test('a starting level gives its points to place (one a level above 1, a stat up to that much higher); the payload carries the level', async () => {
    const calls = [];
    const page = wizardPage(async (type, payload) => (calls.push([type, payload]), { ok: true }), { query: queries({ 'textRpg.rules': { cap: 99 } }) });
    page.type('[data-wiz="name"]', 'Astra');
    page.type('[data-wiz="level"]', '4');
    next(page);
    assert.equal(left(page), 'Points left: 13');
    assert.match(page.q('[data-wiz="stats-note"]').textContent, /Starting at Lv 4 gives you 3 more points to place, and a stat can go that much higher\./);
    raise(page, 'str', 8);
    assert.equal(page.q('[data-stat="str"] .v').textContent, '13', 'a stat may pass 10 by the level\'s points');
    raise(page, 'vit', 5);
    assert.equal(left(page), 'Points left: 0');
    next(page); next(page);
    page.press('[data-wiz="create"]');
    await flush();
    assert.deepEqual(calls[0][1], { name: 'Astra', level: 4, stats: { str: 13, vit: 10, agi: 5, dex: 5, int: 5, wis: 5, cha: 5 }, skills: [] });
});

test('the starting level makes the member with its xp and level points placed, none left to spend; it is refused above the cap and with the wrong total', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost(undefined, { modules: { 'text-rpg': { levelCap: 10 } } });
    try {
        const stats = { ...BUY, str: 15 };
        assert.equal((await host.sdk.command('textRpg.create', { name: 'A', level: 11, stats })).ok, false, 'above the cap');
        assert.equal((await host.sdk.command('textRpg.create', { name: 'A', level: 9, stats: BUY })).ok, false, 'the level\'s 8 points are not placed');
        const made = await host.sdk.command('textRpg.create', { name: 'Astra', level: 9, stats });
        assert.equal(made.ok, true, made.message);
        const me = astraOf(host);
        assert.deepEqual([me.xp, levelOf(me), me.granted, pointsOf(me), effectiveStats(me).str], [800, 9, 8, 0, 15]);
        assert.deepEqual(host.store.problems(), []);
    } finally {
        host.close();
    }
});

test('Start from a saved character: an RPG file fills the stats (held to 5..15), the points, the level and the skills (types mapped); Undo takes it all back and keeps the name', async () => {
    const page = wizardPage(undefined, { query: queries({ 'textRpg.rules': { cap: 99 } }) });
    page.type('[data-wiz="name"]', 'Ren');
    assert.match(page.q('[data-wiz="import"] .ps-p').textContent, /Start from a saved character/);
    await pick(page, rpgFile());
    assert.match(page.q('[data-wiz="import-done"] .ps-p').textContent, /^Imported from ren\.character\.json: stats, 3 unspent points, Lv 5 and 4 skills\. A stat saved above 15 is held at 15, one below 5 raised to 5\. When you press Create it also adds 2 things and 120 money to the purse\. Give the character a name below\.$/);
    assert.equal(page.q('[data-wiz="name"]').value, 'Ren', 'the name stays');
    assert.equal(page.q('[data-wiz="level"]').value, '5');
    next(page);
    assert.deepEqual(page.all('.ps-st .v').map(node => node.textContent), ['14', '12', '9', '15', '5', '8', '7']);
    assert.equal(left(page), 'Points left: 3', 'the file\'s own unspent points');
    assert.equal(page.q('[data-plus="agi"]').hasAttribute('disabled'), false);
    assert.equal(page.q('[data-plus="dex"]').hasAttribute('disabled'), true, 'a stat saved above 10 does not go higher');
    assert.equal(page.q('[data-minus="dex"]').hasAttribute('disabled'), false);
    page.press('[data-minus="dex"]');
    assert.equal(left(page), 'Points left: 4', 'lowering a stat gives its point back');
    page.press('[data-wiz="reset"]');
    assert.equal(left(page), 'Points left: 3');
    page.press('.wz-steps [data-value="skills"]');
    assert.deepEqual(page.all('.wz-skill').map(card => card.querySelector('[data-field="name"]').value), ['Iron Breath', 'Gale', 'Ward', 'Lore']);
    assert.deepEqual(page.all('.wz-skill [data-field="type"]').map(node => node.value), ['attack', 'movement', 'magic', 'utility']);
    assert.equal(page.all('.wz-skill [data-field="stat"]')[3].value, 'str', 'a skill with no stat starts on STR, to be set here');
    page.press('.wz-steps [data-value="who"]');
    page.press('[data-wiz="import-undo"]');
    assert.equal(page.q('[data-wiz="import"]') !== null, true);
    assert.equal(page.q('[data-wiz="name"]').value, 'Ren');
    assert.equal(page.q('[data-wiz="level"]').value, '1');
    next(page);
    assert.deepEqual(page.all('.ps-st .v').map(node => node.textContent), ['5', '5', '5', '5', '5', '5', '5']);
    assert.equal(left(page), 'Points left: 10');
});

test('a bad file says why in plain words and leaves the draft alone: not JSON, not a character, a newer version, a bad stat, too big', async () => {
    const page = wizardPage();
    const says = async (text, size) => { const input = page.q('[data-wiz="import"] input'); input.files = [{ name: 'x.json', size: size ?? text.length, text: async () => text }]; input.dispatchEvent(new globalThis.Event('change')); await flush(); return page.q('[data-wiz="import"] .wz-err')?.textContent; };
    assert.equal(await says('nope'), 'This is not a saved character: the file could not be read.');
    assert.equal(await says('{"a":1}'), 'This is not a saved character file.');
    assert.equal(await says(rpgFile({ storySuiteCharacter: 2 })), 'This file was saved by a newer version, so it cannot be used here.');
    assert.equal(await says(rpgFile({ stats: { str: 99 } })), 'The file has no valid STR (1 to 30).');
    assert.equal(await says('{}', 70000), 'This file is too big to be a saved character.');
    assert.equal(page.q('[data-wiz="import-done"]'), null);
});

test('Create with a saved character sends its stats, level and skills with imported: true, then adds its things and money; a thing that cannot be added is said and the sheet stays with Done', async () => {
    const calls = [];
    const answer = async (type, payload) => {
        calls.push([type, payload]);
        if (type === 'inventory.add') return payload.name === 'Rope' ? { ok: false, message: 'The bag is full.' } : { ok: true, data: { stacks: ['s1'] } };
        return { ok: true };
    };
    const page = wizardPage(answer, { query: queries({ 'textRpg.rules': { cap: 99 }, 'inventory.wallet': { coin: 30 } }) });
    page.type('[data-wiz="name"]', 'Ren');
    await pick(page, rpgFile());
    next(page);
    raise(page, 'wis', 2); raise(page, 'cha', 1);
    next(page); next(page);
    page.press('[data-wiz="create"]');
    await flush(); await flush();
    assert.deepEqual(calls.map(call => call[0]), ['textRpg.create', 'inventory.add', 'inventory.add', 'wallet.set']);
    assert.deepEqual(calls[0][1], {
        name: 'Ren', level: 5, imported: true, budget: 73, stats: { str: 14, vit: 12, agi: 9, dex: 15, int: 5, wis: 10, cha: 8 },
        skills: [{ name: 'Iron Breath', about: 'a blast', stat: 'str', type: 'attack', rank: 2 }, { name: 'Gale', about: 'quick', stat: 'agi', type: 'movement' },
          { name: 'Ward', about: 'a spark', stat: 'int', type: 'magic', rank: 1 }, { name: 'Lore', about: '', stat: 'str', type: 'utility' }],
    });
    assert.deepEqual(calls[1][1], { name: 'Torch', qty: 2, note: 'half burnt', owner: 'party', starting: true });
    assert.deepEqual(calls[3][1], { owner: 'party', amount: 150, starting: true });
    assert.equal(page.q('.wz-status').textContent, 'Ren is made, but not added: Rope (The bag is full.).');
    assert.equal(page.closed(), 0, 'the sheet stays so the reader can read it');
    assert.equal(page.q('.wz-status').getAttribute('role'), 'status');
    assert.deepEqual([page.q('[data-wiz="create"]'), page.q('.wz-foot')], [null, null], 'no Create is left, so the character is not made twice');
    assert.doesNotMatch(page.body.textContent, /null/);
    assert.equal(page.q('[data-wiz="done"]').textContent, 'Done');
    assert.equal(page.q('[data-wiz="done"]').hasAttribute('disabled'), false);
    page.press('.wz-steps [data-value="who"]');
    assert.notEqual(page.q('[data-wiz="done"]'), null, 'the steps are done with');
    page.press('[data-wiz="done"]');
    assert.equal(page.closed(), 1);
    assert.equal(calls.filter(call => call[0] === 'textRpg.create').length, 1);
});

test('a saved character through the real host: the level, the file\'s stats and skills with their ranks as practice, no points left to spend', async t => {
    t.mock.method(console, 'warn', () => {});
    const host = await newHost();
    try {
        const page = wizardPage((type, payload) => host.sdk.command(type, payload), { query: (name, args) => host.sdk.query(name, args) });
        page.type('[data-wiz="name"]', 'Ren');
        await pick(page, JSON.stringify({ ...JSON.parse(rpgFile()), items: undefined, money: undefined }));
        next(page);
        raise(page, 'wis', 2); raise(page, 'cha', 1);
        next(page); next(page);
        page.press('[data-wiz="create"]');
        await flush(); await flush();
        const me = astraOf(host);
        assert.equal(page.closed(), 1);
        assert.deepEqual([me.name, levelOf(me), me.xp, me.granted, pointsOf(me), me.stats.str, me.stats.dex, me.skills.length], ['Ren', 5, 400, 4, 0, 14, 15, 4]);
        assert.deepEqual([me.practice['iron breath'], me.practice.ward, me.practice.gale], [100, 40, undefined]);
        assert.deepEqual(me.skills.map(skill => skill.type), ['attack', 'movement', 'magic', 'utility']);
        assert.deepEqual(host.store.problems(), []);
    } finally {
        host.close();
    }
});

test('while a saved character is in place the starting level is the file\'s and cannot be edited', async () => {
    const page = wizardPage(async () => ({ ok: true }), { query: queries({ 'textRpg.rules': { cap: 99 } }) });
    await pick(page, rpgFile());
    assert.equal(page.q('[data-wiz="level"]').hasAttribute('disabled'), true);
    assert.equal(page.q('[data-wiz="level"]').value, '5');
});
