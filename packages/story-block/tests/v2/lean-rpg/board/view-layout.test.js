// The Fight tab board: status chips, resource strips, layout/CSS, area skills, pending awards, Use item.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STANDARD_FORMULA } from '../../../../src/v2/lean-rpg/rules.js';
import { playBoard } from '../../../../src/v2/lean-rpg/board/engine.js';
import { foeChips, partyChips, pendingAwards, resourcesOf } from '../../../../src/v2/lean-rpg/board/view-data.js';
import { foeGroupChip, resourceStrip, skillButton } from '../../../../src/v2/lean-rpg/board/view-chips.js';
import { boardSession, discardBoard, openBoard } from '../../helpers/board-port.js';
import { character, levelFoeBlock, sheetDomain, skillBlock } from '../helpers.js';
import { page, begin, makeBlocks, settle } from '../view/page.js';
import { setupDom } from '../../view/mounts/helpers.js';
import { AREA_MEMBERS, AREA_ORDER, areaBoard, defineFoes, renderMembers } from './view.helpers.js';

const BOARD_CSS = readFileSync(new URL('../../../../src/v2/lean-rpg/board/board.css', import.meta.url), 'utf8');


test('chips group the foes (×N, Health only), and a single target opens the group, then its members', async t => {
    const { doc, host } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host);
    await defineFoes(host, [['Bristle-boar', 3, 1, 5]]);
    const members = [
        { slot: 11, group: 1, n: 1, name: 'Bristle-boar 1', value: 4, size: 4, pack: false, count: 1, left: 1, attacks: 1, standing: true },
        { slot: 12, group: 1, n: 2, name: 'Bristle-boar 2', value: 0, size: 4, pack: false, count: 1, left: 0, attacks: 0, standing: false },
        { slot: 13, group: 1, n: 3, name: 'Bristle-boar 3', value: 4, size: 4, pack: false, count: 1, left: 1, attacks: 1, standing: true },
    ];
    const root = renderMembers(t, { doc, host, members, order: [{ id: 'c:wessel', name: 'Wessel', party: true },
        { id: 'f:11', name: 'Bristle-boar 1', party: false }, { id: 'f:12', name: 'Bristle-boar 2', party: false },
        { id: 'f:13', name: 'Bristle-boar 3', party: false }] });
    const foes = [...root.querySelectorAll('.rpg-board-cards .rpg-chips-foes .rpg-chip')];
    assert.equal(foes.length, 1, 'three members are ONE chip');
    assert.equal(foes[0].querySelector('.rpg-chip-name').textContent, 'Bristle-boar ×2Lv 1', 'the foes standing, and the level');
    const mini = foes[0].querySelector('.rpg-mini[aria-label="Health"]');
    assert.equal(mini.querySelectorAll('i').length, 4, 'a 4-segment Health mini-bar');
    assert.equal(mini.querySelectorAll('i.lit').length, 3, '8 of 12 blocks: 3 segments lit');
    assert.doesNotMatch(foes[0].textContent, /Unhurt|Mana|Stamina|\d+\/\d+/u, 'Health only');
    assert.equal(root.querySelector('.rpg-board-cards .rpg-foe'), null, 'no foe cards');
    assert.equal(root.querySelector('.rpg-board-order').textContent, 'Order: Wessel · Bristle-boars (1, 2, 3) · 2 attacks on you each exchange');
    assert.ok(root.querySelector('.rpg-board-log').tagName === 'DETAILS', 'the log is one line that opens');
    root.querySelector('[data-choice="1"]').click();   // Attack: one group with several members opens them directly
    assert.equal(root.querySelector('.rpg-board-prompt').textContent, 'Choose a target');
    assert.deepEqual([...root.querySelectorAll('.rpg-board-choices .rpg-board-choice')].map(node => node.textContent),
        ['1. Bristle-boar 1 Unhurt', '2. Bristle-boar 3 Unhurt'], 'Down members are not targetable');
});

test('the status chips and the strip are pure: ×N only above one, Mana omitted without a Mana bar, a skill cost and "not enough"', () => {
    const doc = setupDom();
    const hounds = foeGroupChip(doc, { name: 'Ridge hounds', count: 12, level: 2, value: 5, max: 8, tone: 'warn' });
    assert.equal(hounds.querySelector('.rpg-chip-name').textContent, 'Ridge hounds ×12Lv 2');
    assert.equal(foeGroupChip(doc, { name: 'Gorrak', count: 1, level: 4, value: 4, max: 4, tone: 'good' }).querySelector('.rpg-chip-name').textContent, 'GorrakLv 4');
    assert.equal(hounds.querySelectorAll('.rpg-mini i.lit').length, 3);
    assert.deepEqual(foeChips([{ slot: 11, group: 1, name: 'Wolf 1', value: 4, size: 4, standing: true }, { slot: 12, group: 1, name: 'Wolf 2', value: 2, size: 4, standing: true }], [{ slot: 1, name: 'Wolves', level: 3 }])
        .map(({ name, count, level, value, max }) => ({ name, count, level, value, max })), [{ name: 'Wolves', count: 2, level: 3, value: 6, max: 8 }]);
    assert.deepEqual(partyChips([{ name: 'Astra', level: 3, bars: { health: { value: 2, max: 4 } } }]).map(({ name, level, value, max }) => ({ name, level, value, max })), [{ name: 'Astra', level: 3, value: 2, max: 4 }]);
    const both = resourceStrip(doc, { mana: { value: 10, max: 10 }, stamina: { value: 7, max: 12 } });
    assert.deepEqual([...both.querySelectorAll('.rpg-res-label')].map(node => node.textContent), ['Mana', 'Stamina']);
    assert.deepEqual([...both.querySelectorAll('.rpg-res-count')].map(node => node.textContent), ['10/10', '7/12']);
    assert.equal(both.querySelector('.rpg-res-sp .rpg-res-fill').style.width, '58%');
    const plain = resourceStrip(doc, resourcesOf({ size: { mana: 0, stamina: 6, health: 4 }, mana: 0, stamina: 3 }));
    assert.deepEqual([...plain.querySelectorAll('.rpg-res-label')].map(node => node.textContent), ['Stamina'], 'a member without Mana shows Stamina only');
    assert.equal(resourcesOf({ stamina: 3 }), null, 'no block sizes: no strip');
    const skill = skillButton(doc, { name: 'Flash', stat: 'agi', uses: 'mana', cost: 2, area: true });
    assert.equal(skill.textContent, 'Flasharea · AGI · 2 Mana');
    assert.equal(skill.disabled, false);
    const dull = skillButton(doc, { name: 'Guard Break', stat: 'str', uses: 'stamina', cost: 8, blocked: 'Stamina is Empty' });
    assert.equal(dull.disabled, true);
    assert.equal(dull.textContent, 'Guard BreakSTR · 8 Stamina · not enough');
});

test('the choosing member shows a Mana and Stamina strip right above the skills, and each skill its cost', async t => {
    const { doc, host } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host, { skills: { skill1: 'Shadow Cut', about1: 'sweep every foe', uses1: 'mana', stat1: 'agi' } });
    await defineFoes(host, [['Bristle-boar', 1, 1, 5]]);
    const members = [{ slot: 11, group: 1, n: 1, name: 'Bristle-boar', value: 4, size: 4, pack: false, count: 1, left: 1, attacks: 1, standing: true }];
    const root = renderMembers(t, { doc, host, members, order: [{ id: 'c:wessel', name: 'Wessel', party: true }, { id: 'f:11', name: 'Bristle-boar', party: false }] });
    const strip = root.querySelector('.rpg-board-controls .rpg-actor');
    assert.ok(strip, 'the strip is in the controls');
    assert.deepEqual([...strip.querySelectorAll('.rpg-res-label')].map(node => node.textContent), ['Mana', 'Stamina']);
    assert.equal(strip.nextElementSibling.className, 'rpg-board-choices', 'no named defence skill: no Defence row, the skills follow at once');
    assert.equal(root.querySelector('.rpg-chip-title').textContent, 'Bristle-boar', 'the name is its own wrapping span');
    const skills = [...root.querySelectorAll('.rpg-board-choice')].map(node => node.textContent);
    assert.ok(skills.some(text => /^Shadow Cutarea · AGI · \d Mana$/u.test(text)), JSON.stringify(skills));
});

test('the board draws only party members who have not left, and draws one again when they return', async t => {
    const { doc, host } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host);
    const sister = await makeBlocks(host, { who: 'Temiwa', character: { left: true } });
    await defineFoes(host, [['Bristle-boar', 1, 1, 5]]);
    const foe = { slot: 11, group: 1, n: 1, name: 'Bristle-boar', value: 4, size: 4, pack: false, count: 1, left: 1, attacks: 1, standing: true };
    const order = [{ id: 'c:wessel', name: 'Wessel', party: true }, { id: 'f:11', name: 'Bristle-boar', party: false }];
    const names = root => [...root.querySelectorAll('.rpg-board-cards .rpg-chip-party .rpg-chip-name')].map(node => node.textContent.replace(/Lv \d+$/u, ''));
    for (const members of [[foe], null]) {
        assert.deepEqual(names(renderMembers(t, { doc, host, members, order })), ['Wessel'], `a member who left is not drawn (${members ? 'members' : 'plain'} layout)`);
        discardBoard(host.ctx.chatMetadata);
    }
    const back = await host.sdk.command('dm.set', { module: sister.character, field: 'left', value: false });
    assert.equal(back.ok, true, back.message);
    for (const members of [[foe], null]) {
        assert.deepEqual(names(renderMembers(t, { doc, host, members, order })).sort(), ['Temiwa', 'Wessel'], 'a member who returns is drawn again');
        discardBoard(host.ctx.chatMetadata);
    }
});

test('E5: a newly opened board shows the seeded member order before the first choice', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host);
    await defineFoes(host, [['Bristle-boar', 3, 1, 5]]);
    const sid = host.store.carrierSid(host.store.headIndex()), meta = host.ctx.chatMetadata;
    const opened = openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
    assert.equal(opened.error, undefined, opened.error);
    assert.equal(boardSession(meta).exchanges.length, 0);
    ui.mounts.screen.open('story-block/fight');
    await settle();
    const order = doc.querySelector('[data-ss-screen="story-block/fight"] .rpg-board-order');
    assert.ok(order, 'the order line is present before any choice');
    // (the world's Foes block is a new one, so the harder-foes cap shows: three boars make 3 attacks, the party of one takes at most 2)
    assert.match(order.textContent, /^Order: .*Bristle-boars \(1, 2, 3\).*2 attacks on you each exchange$/u);
});

test('a pack is one chip with about how many are left, and stays a single target', async t => {
    const { doc, host } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host);
    await defineFoes(host, [['Cellar-rats', 12, 1, 5]]);
    const pack = { slot: 11, group: 1, n: 1, name: 'Cellar-rats', value: 5, size: 8, pack: true, count: 12, left: 8, attacks: 2, standing: true };
    const root = renderMembers(t, { doc, host, members: [pack], order: [{ id: 'c:wessel', name: 'Wessel', party: true }, { id: 'f:11', name: 'Cellar-rats', party: false }] });
    const chip = root.querySelector('.rpg-chips-foes .rpg-chip');
    assert.equal(chip.querySelector('.rpg-chip-name').textContent, 'Cellar-rats ×8Lv 1');
    assert.equal(root.querySelector('.rpg-board-order').textContent, 'Order: Wessel · Cellar-rats · 2 attacks on you each exchange');
    root.querySelector('[data-choice="1"]').click();   // one group, one member: no target step
    assert.equal(boardSession(host.ctx.chatMetadata).exchanges[0].actions[0].target, 11);
});

test('a Down pack stays as a dimmed chip', async t => {
    const { doc, host } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host);
    await defineFoes(host, [['Cellar-rats', 12, 1, 5]]);
    const pack = { slot: 11, group: 1, n: 1, name: 'Cellar-rats', value: 0, size: 8, pack: true, count: 12, left: 0, attacks: 0, standing: false };
    const root = renderMembers(t, { doc, host, members: [pack], order: [] });
    const chip = root.querySelector('.rpg-chips-foes .rpg-chip');
    assert.ok(chip.classList.contains('rpg-chip-down'));
    assert.equal(chip.querySelectorAll('.rpg-mini i.lit').length, 0);
    assert.equal(root.classList.contains('rpg-board-finished'), false);
});

test('nothing on the board scrolls: no observers, no inner scrollers, a sticky status, two columns from 700px, three skill columns from 900px', async t => {
    const { doc, host } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host);
    await defineFoes(host, [['Cellar-rats', 12, 1, 5]]);
    const observers = [];
    doc.defaultView.ResizeObserver = class { constructor() { observers.push(this); } observe() {} unobserve() {} disconnect() {} };
    const pack = { slot: 11, group: 1, n: 1, name: 'Cellar-rats', value: 5, size: 8, pack: true, count: 12, left: 8, attacks: 2, standing: true };
    const root = renderMembers(t, { doc, host, members: [pack], order: [] });
    assert.equal(observers.length, 0, 'no measuring: nothing is sized to fit a scroller');
    assert.ok(root.querySelector('.rpg-board-body > .rpg-board-status'));
    assert.ok(root.querySelector('.rpg-board-body > .rpg-board-controls'));
    assert.doesNotMatch(BOARD_CSS, /(?:overflow(?:-y)?\s*:\s*(?:auto|scroll)|scroll-snap|max-height\s*:\s*35vh|--rpg-card-row-height|--rpg-choice-limit)/u);
    assert.match(BOARD_CSS, /@media \(max-width: 759\.98px\) \{\s*[^}]*\.rpg-board-status \{ position: sticky; top: 0;/u);
    assert.match(BOARD_CSS, /\.rpg-board-active \{ container: rpgboard \/ inline-size;/u);
    assert.match(BOARD_CSS, /@container rpgboard \(min-width: 700px\) \{[^@]*grid-template-columns: minmax\(0, 1\.1fr\) minmax\(0, 1fr\)[^@]*flex: 0 0 calc\(\(100% - 10px\) \/ 3\)[^@]*flex: 0 0 calc\(\(100% - 15px\) \/ 4\)/u);
    assert.match(BOARD_CSS, /\.rpg-board-choices \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
    assert.match(BOARD_CSS, /@container rpgboard \(min-width: 900px\) \{ \.rpg-board-choices \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/u);
    assert.match(BOARD_CSS, /\.rpg-skill-blocked \{ opacity: \.45; \}/u);
    assert.match(BOARD_CSS, /\.rpg-board-members \.rpg-board-controls button \{ min-height: calc\(48px \/ var\(--ss-zoomed, 1\)\) !important; \}/u);
});

test('a log the reader opened stays open across the redraws of a running fight', async t => {
    const { doc, host } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host);
    await defineFoes(host, [['Bristle-boar', 2, 1, 5]]);
    const members = [11, 12].map(slot => ({ slot, group: 1, n: slot - 10, name: `Bristle-boar ${slot - 10}`, value: 4, size: 4, pack: false, count: 1, left: 1, attacks: 1, standing: true }));
    const root = renderMembers(t, { doc, host, members, order: [] });
    const log = () => root.querySelector('.rpg-board-log');
    assert.equal(log().open, false, 'closed at first');
    log().open = true;
    log().dispatch('toggle');
    root.querySelector('[data-choice="1"]').click();   // a choice redraws the board
    assert.equal(log().open, true, 'still open after the redraw');
});

test('an area skill is one tap: it stages at once with no group, and the staged line reads just who and the skill', async t => {
    const { host, root } = await areaBoard(t, {});
    const area = [...root.querySelectorAll('.rpg-board-choice')].find(node => node.textContent.includes('Shadow Cut'));
    assert.match(area.textContent, /^Shadow Cutarea · STR · 2 Mana$|^Shadow Cutarea · \w+ · 1 Mana$/u);
    area.click();
    const exchanges = boardSession(host.ctx.chatMetadata).exchanges;
    assert.equal(exchanges.length, 1, 'staged by the one tap (a one-member party)');
    assert.equal(exchanges[0].actions[0].area, true);
    assert.equal('group' in exchanges[0].actions[0], false, 'no group');
    assert.equal(root.querySelector('.rpg-board-area-note'), null);
});

test('the staged line of an area skill reads just "Temiwa · Shadow Cut" in a party of two', async t => {
    const { doc, host } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host);
    await makeBlocks(host, { who: 'Temiwa', skills: { skill1: 'Shadow Cut', about1: 'sweep every foe', uses1: 'mana' } });   // Temiwa chooses first
    await defineFoes(host, [['Bristle-boar', 3, 1, 5], ['Spiders', 2, 1, 5]]);
    const root = renderMembers(t, { doc, host, members: AREA_MEMBERS.slice(0, 4), order: AREA_ORDER });
    [...root.querySelectorAll('.rpg-board-choice')].find(node => node.textContent.includes('Shadow Cut')).click();
    assert.equal(root.querySelector('.rpg-board-staged').textContent, 'Temiwa · Shadow Cut');
    assert.equal(root.querySelector('.rpg-board-prompt').textContent, 'Wessel: choose an action');
    assert.equal(root.querySelector('.rpg-board-step').textContent, '2 of 2');
    assert.equal(boardSession(host.ctx.chatMetadata).exchanges.length, 0, 'the exchange waits for the second member');
    assert.equal(root.querySelector('.rpg-board-back').disabled, false, 'Back is live once something is staged');
    root.querySelector('.rpg-board-back').click();   // Back takes the staged action back
    assert.equal(root.querySelector('.rpg-board-staged'), null);
    assert.equal(root.querySelector('.rpg-board-back').disabled, true, 'Back stays in its row, disabled, with nothing to take back');
});

test('a fight staged before areaAll keeps asking for a main group when more than one group stands', async t => {
    const { root } = await areaBoard(t, { oldArea: true });
    const area = [...root.querySelectorAll('.rpg-board-choice')].find(node => node.textContent.includes('Shadow Cut'));
    area.click();
    assert.equal(root.querySelector('.rpg-board-prompt').textContent, 'Wessel: Shadow Cut (area)');
    assert.equal(root.querySelector('.rpg-board-area-note').textContent, 'Hits every enemy group. The group you pick takes the full effect, and the others take one Health block less.');
    assert.deepEqual([...root.querySelectorAll('.rpg-board-choices .rpg-board-choice')].map(node => node.textContent), ['Main target: Bristle-boars', 'Main target: Spiders']);
});

test('the board log shows one line per area group without repeating the roll', async t => {
    const { doc, host } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host, { skills: { skill1: 'Shadow Cut', about1: 'sweep every foe', uses1: 'mana' } });
    await defineFoes(host, [['Tunnel Rat', 24, 1, 5], ['Grey-Tooth Nest-Mother', 1, 1, 5]]);
    const order = [{ id: 'c:wessel', name: 'Wessel', total: 100 }, { id: 'f:11', name: 'Tunnel Rat pack 1', total: 1 },
        { id: 'f:12', name: 'Tunnel Rat pack 2', total: 1 }, { id: 'f:2', name: 'Grey-Tooth Nest-Mother', total: 1 }];
    const played = playBoard(host.head(), { seed: 3, offset: 0, rules: { ...STANDARD_FORMULA, levelDivisor: 5 }, members: 1, aoe: 1, order },
        [{ actions: [{ who: 'Wessel', kind: 'skill', skill: 'Shadow Cut', area: true, group: 1 }] }]);
    assert.equal(played.error, undefined, played.error);
    const root = renderMembers(t, { doc, host, members: played.result.members, order: played.result.order, rounds: played.result.rounds });
    const lines = [...root.querySelectorAll('.rpg-board-log-content p')].map(node => node.textContent);
    const main = lines.filter(text => text.startsWith('Wessel → Tunnel Rat packs'));
    const other = lines.filter(text => /^… also (hits|targets) Grey-Tooth Nest-Mother \(reduced\)/u.test(text));
    assert.equal(main.length, 1, JSON.stringify(lines));
    assert.equal(other.length, 1, JSON.stringify(lines));
    assert.match(main[0], /d20/u);
    assert.doesNotMatch(other[0], /d20/u);
});

test('pending awards use opening groups, settings and the per-reply practice cap', () => {
    const state = { domains: { dataModules: sheetDomain({
        hero: { role: 'character', fields: character('Astra', { level: 1 }) },
        skills: { role: 'skills', fields: skillBlock('Astra', [['Cut', 3]]) },
        foes: { role: 'foes', fields: levelFoeBlock([['Rats', 2, 1, 0], ['Spiders', 3, 1, 0]]) },
    }) } };
    const result = { stop: 'won', rounds: Array.from({ length: 8 }, (_, n) => ({ n: n + 2, lines: [{ pc: { who: 'Astra' }, skill: 'Cut' }] })) };
    const awards = pendingAwards(state, { groups: [1, 2], setup: { offset: 1 } }, result, { rpgXpRate: 200, rpgPracticePerUse: 5 });
    assert.deepEqual(awards.xp, [{ who: 'Astra', amount: 40 }]);
    assert.deepEqual(awards.practice, [{ who: 'Astra', skill: 'Cut', amount: 20 }]);
    assert.deepEqual(pendingAwards(state, { groups: [1, 2] }, { ...result, stop: 'fled' }).xp, []);
    Object.assign(state.domains.dataModules.instances['pack.chat/foes'].chat.fields, { count1: 2, count2: 0 });
    assert.deepEqual(pendingAwards(state, { groups: [1], setup: { bars: 2 } }, result).xp, [{ who: 'Astra', amount: 45 }], 'the current flat-rule preview includes the bonus');
    state.domains.dataModules.instances['pack.chat/foes'].chat.fields.count2 = 3;
    Object.assign(state.domains.dataModules.instances['pack.chat/foes'].chat.fields, { count1: 50, level1: 99 });
    assert.deepEqual(pendingAwards(state, { groups: [1, 2] }, result, { rpgXpRate: 300 }).xp, [{ who: 'Astra', amount: 180 }], 'the raw fight XP is capped before scaling');
});

test('Use item: the board lists the bag\'s consumables, then who it is for, stages it as the member\'s action and tells it in the log', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host, { character: { health: 2, vit: 20 } });
    await defineFoes(host, [['Rats', 1, 1, 12]]);
    const fight = () => doc.querySelector('[data-ss-screen="story-block/fight"]');
    const open = async () => { ui.mounts.screen.open('story-block/fight'); await settle(); fight().querySelector('.rpg-board-open').click(); };
    await open();
    const labels = () => [...fight().querySelectorAll('.rpg-board-choice')].map(node => node.textContent);
    assert.equal(labels().some(text => /Use item/.test(text)), false, 'an empty bag: no Use item');
    fight().querySelector('.rpg-board-discard').click();
    fight().querySelector('.rpg-board-confirm').click();
    for (const [name, rarity, qty] of [['Healing Draught', 'rare', 3], ['Mana Potion', 'common', 1]]) {
        const granted = await host.bus.command('inventory.grant', { def: { name, kind: 'consumable', rarity }, qty }, { cause: 'system' });
        assert.equal(granted.ok, true, granted.message);
    }
    await settle();
    ui.mounts.screen.open('story-block/fight');
    await settle();
    if (fight().querySelector('.rpg-board-open')) fight().querySelector('.rpg-board-open').click();
    const use = [...fight().querySelectorAll('.rpg-board-choice')].find(node => /Use item/.test(node.textContent));
    assert.ok(use, 'Use item sits beside Attack, the skills and Flee');
    assert.ok(labels().findIndex(text => /Use item/.test(text)) < labels().findIndex(text => /Flee/.test(text)), 'before Flee');
    use.click();
    assert.match(fight().textContent, /Choose an item/);
    assert.deepEqual(labels(), ['Healing Draught ×3 — health +4', 'Mana Potion ×1 — mana +2'], 'name, count, what it restores and how much');
    fight().querySelector('[data-choice="1"]').click();
    assert.match(fight().textContent, /Choose who it is for/);
    assert.match(labels()[0], /^Wessel — health 2 of 16$/);
    fight().querySelector('[data-choice="1"]').click();
    const session = boardSession(host.ctx.chatMetadata);
    assert.equal(session.exchanges.length, 1, 'one member: the exchange is staged');
    assert.deepEqual(session.exchanges[0].actions, [{ who: 'Wessel', kind: 'item', stack: session.exchanges[0].actions[0].stack, target: 'Wessel' }]);
    assert.match(fight().querySelector('.rpg-board-log').textContent, /Wessel drinks the Healing Draught \(\+4 health\)/);
    await new Promise(resolve => setTimeout(resolve, 450));   // (the board locks its choices for 400 ms after a roll)
    const again = [...fight().querySelectorAll('.rpg-board-choice')].find(node => /Use item/.test(node.textContent));
    again.click();
    assert.deepEqual(labels(), ['Healing Draught ×2 — health +4', 'Mana Potion ×1 — mana +2'], 'the dose staged is already counted out');
});
