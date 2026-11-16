// The Fight tab board: target selection, end cards, defence labels, choice lock, rules/stale/held checks, broken weapon.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STANDARD_TEMPLATES } from '../../../../modules/rpg/templates.js';
import { STANDARD_FORMULA } from '../../../../modules/rpg/rules.js';
import { STAGES, stageWord } from '../../../../modules/rpg/names.js';
import { usesOf } from '../../../../modules/rpg/practice.js';
import { playBoard } from '../../../../modules/rpg/board/engine.js';
import { createBoardView } from '../../../../modules/rpg/board/view.js';
import { boardSession, discardBoard, openBoard, stageExchange } from '../../../../modules/rpg/board/session.js';
import { page, begin, makeBlocks, settle } from '../view/page.js';
import { planGear } from '../../../../modules/rpg/gear.js';
import { readSheet } from '../../../../modules/rpg/read.js';
import { aiMessage } from '../../../../testkit/fake-st.js';
import { defineFoes, showStop } from './view.helpers.js';

test('the board selects a target, keeps its exchange final and confirms discard', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host, { skills: { skill1: 'Shadow Cut', about1: 'sweep every foe', uses1: 'mana' }, character: { mana: 0 } });
    await defineFoes(host, [['Rats', 2, 1, 12], ['Spiders', 1, 1, 12]]);
    await settle();
    ui.mounts.screen.open('story-block/fight');
    await settle();
    const fight = () => doc.querySelector('[data-ss-screen="story-block/fight"]');
    assert.ok(fight().querySelector('.rpg-board-open'));
    fight().querySelector('.rpg-board-open').click();
    assert.ok(fight().querySelector('.rpg-board-log'));
    const blocked = fight().querySelectorAll('.rpg-board-choice').find(node => node.textContent.includes('Shadow Cut'));
    assert.equal(blocked.disabled, true);
    assert.match(blocked.textContent, /not enough/);
    assert.ok(blocked.classList.contains('rpg-skill-blocked'), 'greyed');
    doc.key('1');
    assert.match(fight().textContent, /Choose a group/, 'single target: groups first');
    const groups = [...fight().querySelectorAll('.rpg-board-choice')].map(node => node.textContent);
    assert.deepEqual(groups, ['1. Rats ×2', '2. Spiders']);
    fight().querySelector('[data-choice="1"]').click();   // a group of several opens its members
    assert.match(fight().textContent, /Choose a target/);
    const targets = [...fight().querySelectorAll('.rpg-board-choice')].map(node => node.textContent);
    assert.ok(targets.some(text => /Rats 1\s+Unhurt/.test(text)), 'the target line names each standing member and its bar');
    assert.ok(targets.some(text => /Rats 2\s+Unhurt/.test(text)), 'every standing member has a target line');
    const rowOf = cls => fight().querySelector(`.${cls}`).parentNode;
    assert.equal(rowOf('rpg-board-back'), rowOf('rpg-board-discard'), 'Back and Discard fight share one row container');
    assert.match(rowOf('rpg-board-back').className, /rpg-board-actions/);
    const escape = { key: 'Escape', preventDefault() {}, stopImmediatePropagation() {}, stopPropagation() {} };
    doc.listeners.find(entry => entry.fn.name === 'keydown' && entry.capture).fn(escape);
    assert.match(fight().textContent, /choose an action/);
    assert.equal(rowOf('rpg-board-auto'), rowOf('rpg-board-discard'), 'Auto and Discard fight share one row container');
    fight().querySelector('[data-choice="1"]').click();
    fight().querySelector('[data-choice="1"]').click();
    fight().querySelector('[data-choice="2"]').click();
    assert.match(fight().querySelector('.rpg-board-log').textContent, /Exchange 1/);
    const excerpt = fight().querySelector('.rpg-board-excerpt');   // the wide board's two-line box (board.css clamps it; a phone hides it)
    assert.ok(excerpt && excerpt.textContent.length > 0 && !/Exchange 1/.test(excerpt.textContent), 'the last exchange\'s lines, without its heading');
    const kids = [...fight().querySelector('.rpg-board-body').children]; assert.ok(kids.indexOf(excerpt) + 1 === kids.indexOf(fight().querySelector('.rpg-board-log')), 'the excerpt sits right above the log summary');
    assert.equal(fight().querySelector('.rpg-board-undo'), null);
    assert.equal(boardSession(host.ctx.chatMetadata).exchanges.length, 1);
    fight().querySelector('.rpg-board-discard').click();
    assert.match(fight().textContent, /Discard this fight/);
    assert.equal(rowOf('rpg-board-confirm'), fight().querySelectorAll('.ss-button').find(node => node.textContent === 'Cancel').parentNode, 'the confirm pair shares a row');
    fight().querySelectorAll('.ss-button').find(node => node.textContent === 'Cancel').click();
    assert.equal(boardSession(host.ctx.chatMetadata).exchanges.length, 1);
    fight().querySelector('.rpg-board-discard').click();
    fight().querySelector('.rpg-board-confirm').click();
    assert.ok(fight().querySelector('.rpg-board-open'));
});

test('the marked board stages a selected heal on its named party member and labels the result', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    // (Health 8 of 16 blocks: a decisive foe hit of the harder-foes rule takes 4 and cannot Down Wessel before her Mend is told)
    await makeBlocks(host, { character: { health: 8, vit: 20 }, skills: { skill1: 'Mend', about1: 'heal an ally', stat1: 'int', uses1: 'mana' } });
    await defineFoes(host, [['Rat', 1, 1, 4]]);
    ui.mounts.screen.open('story-block/fight');
    await settle();
    const fight = () => doc.querySelector('[data-ss-screen="story-block/fight"]');
    fight().querySelector('.rpg-board-open').click();
    const choice = fight().querySelectorAll('.rpg-board-choice').find(node => node.textContent.includes('Mend → Wessel'));
    assert.ok(choice);
    choice.click();
    assert.equal(boardSession(host.ctx.chatMetadata).exchanges[0].actions[0].support, true);
    assert.match(fight().querySelector('.rpg-board-log').textContent, /Wessel heals Wessel \(Mend\)/);
});

test('the board ends on a won card', async t => {
    const { doc, result } = await showStop(t, {
        character: { str: 20, agi: 20 }, foes: [['Rats', 1, 1, 1]],
        action: [{ who: 'Wessel', kind: 'attack', target: 1 }], stop: 'won',
    });
    const fight = doc.querySelector('[data-ss-screen="story-block/fight"]');
    assert.equal(result.stop, 'won');
    assert.match(fight.querySelector('.rpg-board-end').textContent, /Fight won/);
    assert.ok(fight.querySelector('.rpg-board-active').classList.contains('rpg-board-finished'), 'an ended board unlocks its phone layout');
    assert.match(fight.textContent, /Your next message carries this fight/);
    assert.match(fight.querySelector('.rpg-board-awards').textContent, /Pending XP: Wessel \+\d+ XP\. Pending practice: none/);
    assert.match(fight.querySelector('.rpg-board-awards-phone').textContent, /^Pending: Wessel \+\d+ XP$/);
    assert.ok(fight.querySelector('.rpg-board-note'));
});

test('the board ends on a lost card', async t => {
    const { doc, result } = await showStop(t, {
        character: { str: 3, agi: 3, vit: 3, health: 1 }, foes: [['Rats', 12, 99, 15]],
        action: [{ who: 'Wessel', kind: 'attack', target: 11 }], stop: 'lost',
    });
    const fight = doc.querySelector('[data-ss-screen="story-block/fight"]');
    assert.equal(result.stop, 'lost');
    assert.match(fight.querySelector('.rpg-board-end').textContent, /Fight lost/);
});

test('the board ends on a fled card', async t => {
    const { doc, result } = await showStop(t, {
        character: { agi: 20 }, foes: [['Rats', 1, 1, 12]],
        action: [{ who: 'Wessel', kind: 'flee' }], stop: 'fled',
    });
    const fight = doc.querySelector('[data-ss-screen="story-block/fight"]');
    assert.equal(result.stop, 'fled');
    assert.match(fight.querySelector('.rpg-board-end').textContent, /Fight fled/);
});

test('the end card uses the current XP rate and practice setting', async t => {
    const { doc, result } = await showStop(t, {
        character: { str: 20, agi: 20 }, skills: { skill1: 'Cut', about1: 'strike a foe', stat1: 'str', uses1: 'stamina' },
        settings: { rpgXpRate: 200, rpgPracticePerUse: 5 }, foes: [['Rats', 1, 1, 1]],
        action: [{ who: 'Wessel', kind: 'skill', skill: 'Cut', target: 1 }], stop: 'won',
    });
    const awards = doc.querySelector('.rpg-board-awards').textContent;
    assert.match(awards, /Wessel \+30 XP/);
    const uses = usesOf(result).find(item => item.skill === 'Cut').n;
    assert.ok(awards.includes(`Wessel: Cut +${Math.min(20, uses * 5)}`));
});

for (const outcome of ['success', 'fail', 'soaked']) test(`the log labels a defence ${outcome} and uses words for bars`, async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host);
    await defineFoes(host, [['Rats', 3, 3, 5]]);
    const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
    let result, defence;
    for (let attempt = 0; attempt < 200; attempt += 1) {
        openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        result = stageExchange(meta, host.head(), [{ who: 'Wessel', kind: 'attack', target: 11 }]).preview?.result;
        defence = result?.rounds.flatMap(round => round.lines).find(line => line.kind === 'foe' && (outcome === 'soaked' ? Number.isInteger(line.soaked) : line.outcome === outcome && line.soaked === undefined));
        if (defence) break;
        discardBoard(meta);
    }
    assert.ok(defence);
    ui.mounts.screen.open('story-block/fight');
    await settle();
    const log = doc.querySelector('.rpg-board-log').textContent;
    assert.match(log, new RegExp(`Rats 1 attacks Wessel.*Wessel's defence: ${outcome === 'soaked' ? 'GLANCED OFF' : outcome.toUpperCase()}`));
    assert.match(log, /d20 \d+ [+-]\d+ = \d+ vs \d+/);
    // (the foe's own roll first, then the defender's, so "FAIL" reads as the foe's hit: the totals are the recorded ones)
    const attack = new RegExp(`${defence.foe.name} attacks Wessel: ${defence.foe.name} d20 ${defence.foe.die} [+-]\\d+ = ${defence.foe.total} vs Wessel's defence d20 ${defence.pc.die} [+-]\\d+ = ${defence.pc.total} — `);
    assert.match(log, attack);
    assert.doesNotMatch(log, /(?:health|mana|stamina)\s+\d+\s*→\s*\d+/i);
    if (defence.damage) assert.ok(log.includes(`Wessel health ${stageWord(STAGES.health, defence.damage.from, defence.damage.size)} → ${stageWord(STAGES.health, defence.damage.to, defence.damage.size)}`));
    assert.doesNotMatch(doc.querySelector('.rpg-board-status').textContent, /\d+ of \d+/);
});

test('Standard block bars show words without counts on the board', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    for (const role of ['character', 'foes']) {
        const definition = structuredClone(STANDARD_TEMPLATES.find(item => item.definition.role === role).definition);
        if (role === 'character') Object.assign(definition.state.who, { default: 'Wessel' });
        else for (const [key, value] of Object.entries({ foe1: 'Rats', count1: 1, level1: 1, hurt1: 2 })) definition.state[key].default = value;
        const made = await host.sdk.command('dm.define', { definition });
        assert.equal(made.ok, true, made.message);
    }
    const sid = host.store.carrierSid(host.store.headIndex());
    assert.equal(openBoard(host.ctx.chatMetadata, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } }).error, undefined);
    ui.mounts.screen.open('story-block/fight');
    await settle();
    const status = doc.querySelector('.rpg-board-status').textContent;
    assert.ok(doc.querySelector('.rpg-board-status .rpg-mini[aria-label="Health"]'), 'Health is a mini-bar on the chip');
    assert.doesNotMatch(status, /Unhurt|Hurt|Mana|Stamina/, 'chips carry Health only');
    assert.doesNotMatch(status, /\d+\s+of\s+\d+/);
});

test('a replacement choice stays locked after a roll, then accepts a later action', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host, { character: { vit: 20 } });
    await defineFoes(host, [['Rats', 12, 3, 5]]);
    const meta = host.ctx.chatMetadata, state = host.head(), sid = host.store.carrierSid(host.store.headIndex());
    const action = [{ who: 'Wessel', kind: 'attack', target: 11 }];
    let found = false;
    for (let n = 0; n < 100; n += 1) {
        openBoard(meta, state, { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        const played = playBoard(state, boardSession(meta).setup, [{ actions: action }, { actions: action }]);
        if (!played.error && played.result.stop === 'open') { found = true; break; }
        discardBoard(meta);
    }
    assert.ok(found);
    ui.mounts.screen.open('story-block/fight');
    await settle();
    const fight = () => doc.querySelector('[data-ss-screen="story-block/fight"]');
    fight().querySelector('[data-choice="1"]').click();
    assert.equal(boardSession(meta).exchanges.length, 1);
    const replacement = fight().querySelector('[data-choice="1"]');
    assert.equal(replacement.disabled, true);
    replacement.click();
    assert.equal(boardSession(meta).exchanges.length, 1);
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(replacement.disabled, false);
    replacement.click();
    assert.equal(boardSession(meta).exchanges.length, 2);
});

test('a refused exchange keeps its reason on the board after the redraw', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host, { character: { vit: 20 } });
    await defineFoes(host, [['Rats', 12, 3, 5]]);
    const meta = host.ctx.chatMetadata, state = host.head(), sid = host.store.carrierSid(host.store.headIndex());
    const action = [{ who: 'Wessel', kind: 'attack', target: 11 }];
    let found = false;
    for (let n = 0; n < 100; n += 1) {
        openBoard(meta, state, { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
        const played = playBoard(state, boardSession(meta).setup, [{ actions: action }, { actions: action }]);
        if (!played.error && played.result.stop === 'open') { found = true; break; }
        discardBoard(meta);
    }
    assert.ok(found);
    ui.mounts.screen.open('story-block/fight');
    await settle();
    const fight = () => doc.querySelector('[data-ss-screen="story-block/fight"]');
    fight().querySelector('[data-choice="1"]').click();
    await new Promise(resolve => setTimeout(resolve, 500));
    boardSession(meta).setup.witness.offset += 1;
    fight().querySelector('[data-choice="1"]').click();
    assert.match(fight().querySelector('.rpg-board-error')?.textContent ?? '', /cannot be checked/, 'the reason survives the redraw');
});

test('the board checks current and saved rules, including a stale offer', async t => {
    const { doc, host } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host);
    await defineFoes(host, [['Rats', 1, 1, 5]]);
    const meta = host.ctx.chatMetadata, standard = { ...STANDARD_FORMULA, levelDivisor: 5 }, classic = { ...standard, formula: 'classic' };
    let current = standard;
    const board = createBoardView({ doc, headState: () => host.head(), meta: () => meta, store: host.store, rules: () => current,
        query: (name, args) => host.sdk.query(name, args), readerName: () => 'Wessel', levels: () => ({}), on: () => true });
    t.after(() => board.destroy());
    const holder = doc.createElement('div');
    board.offer(holder, () => {});
    current = classic;
    holder.querySelector('.rpg-board-open').click();
    assert.equal(boardSession(meta), null, 'a stale offer cannot open under Classic');
    current = standard;
    assert.equal(openBoard(meta, host.head(), { sid: host.store.carrierSid(host.store.headIndex()), rules: standard }).error, undefined);
    assert.ok(board.snapshot(host.head()));
    current = classic;
    assert.match(board.snapshot(host.head()).played.error, /Standard.*discard/i, 'a staged fight remains accessible under Classic');
    current = standard;
    boardSession(meta).setup.rules = classic;
    assert.match(board.snapshot(host.head()).played.error, /setup is damaged/i, 'an unsupported saved session can be discarded');
});

test('a staged fight remains discardable when its opening reply no longer matches', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    await makeBlocks(host);
    await defineFoes(host, [['Rats', 3, 3, 5]]);
    const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
    openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
    stageExchange(meta, host.head(), [{ who: 'Wessel', kind: 'attack', target: 11 }]);
    boardSession(meta).anchor = 'missing-reply';
    ui.mounts.screen.open('story-block/fight');
    await settle();
    const fight = () => doc.querySelector('[data-ss-screen="story-block/fight"]');
    assert.match(fight().textContent, /no longer matches.*restore.*discard/i);
    fight().querySelector('.rpg-board-discard').click();
    fight().querySelector('.rpg-board-confirm').click();
    assert.equal(boardSession(meta), null);
});

test('a changed sheet leaves discard and its confirmation on the board', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    const blocks = await makeBlocks(host, { character: { str: 10 } });
    await defineFoes(host, [['Rats', 3, 3, 5]]);
    const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
    openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
    assert.equal(stageExchange(meta, host.head(), [{ who: 'Wessel', kind: 'attack', target: 11 }]).error, undefined);
    assert.equal((await host.sdk.command('dm.set', { module: blocks.character, field: 'str', value: 12 })).ok, true);
    ui.mounts.screen.open('story-block/fight');
    await settle();
    const fight = () => doc.querySelector('[data-ss-screen="story-block/fight"]');
    assert.match(fight().textContent, /sheet or gear changed.*restore.*discard/i);
    fight().querySelector('.rpg-board-discard').click();
    assert.match(fight().textContent, /Discard this fight/);
    fight().querySelector('.rpg-board-confirm').click();
    assert.equal(boardSession(meta), null);
});

test('the reloaded board explains a held reply and lets the reader discard it', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    await begin(host);
    const blocks = await makeBlocks(host, { character: { str: 10 } });
    await defineFoes(host, [['Rats', 3, 3, 5]]);
    const meta = host.ctx.chatMetadata, sid = host.store.carrierSid(host.store.headIndex());
    openBoard(meta, host.head(), { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 } });
    stageExchange(meta, host.head(), [{ who: 'Wessel', kind: 'attack', target: 11 }]);
    host.st.addUser('I strike.');
    await host.turn.interceptor([], 8192, () => assert.fail('the fight should preflight'), 'normal');
    const edit = host.bus.run('dm.set', { module: blocks.character, field: 'str', value: 12 }, { cause: 'ui' });
    assert.equal(edit.ok, true, edit.message);
    host.store.append({ ops: edit.ops, receipt: edit.receipt, ...(edit.block ? { block: edit.block } : {}) });
    await host.store.flush();
    assert.equal(host.head().domains.dataModules.instances[blocks.character].chat.fields.str, 12);
    const index = host.st.addMessage(aiMessage('The fight continues.'));
    assert.equal(await host.turn.onMessageReceived(index), null);
    await host.store.flush();
    const chat = structuredClone(host.st.saves.at(-1));
    host.ctx.chatMetadata = structuredClone(meta);
    await host.st.loadChat(chat, 'held-board-view');
    ui.mounts.screen.open('story-block/fight');
    await settle();
    const fight = () => doc.querySelector('[data-ss-screen="story-block/fight"]');
    assert.match(fight().textContent, /waiting.*restore.*discard.*regenerate/i);
    fight().querySelector('.rpg-board-discard').click();
    fight().querySelector('.rpg-board-confirm').click();
    assert.equal(boardSession(host.ctx.chatMetadata), null);
    assert.equal(host.ctx.chatMetadata.rpgFightHeldDiscarded[host.store.carrierSid(index)], true);
    assert.match(fight().textContent, /discarded.*regenerate/i);
    assert.equal((await host.turn.reread(index)).ok, false);
});

test('the next attack choice loses a weapon that broke in the staged exchange', async t => {
    const { doc, host, ui } = await page(t, { formula: 'standard' });
    host.features.set('story-block.gear', true);
    await begin(host);
    await makeBlocks(host, { character: { str: 3, dex: 12, agi: 10, vit: 20 } });
    await defineFoes(host, [['Rats', 6, 60, 5]]);
    await host.send('Equip.', 'Ready.\n<Changes>\n+ item Cane Sword | kind: weapon | rarity: rare | DEX: +2 | equipped: weapon\n</Changes>');
    assert.equal(host.bus.command('gear.wear', { owner: 'party', slot: 'weapon', steps: 2 }, { cause: 'system' }).ok, true);
    const meta = host.ctx.chatMetadata, state = host.head(), sid = host.store.carrierSid(host.store.headIndex());
    const query = (name, args) => host.sdk.query(name, args);
    const gear = planGear(readSheet(state), query), weapon = query('inventory.gear', { owner: 'party' }).slots.weapon;
    let result = null;
    for (let attempt = 0; attempt < 200; attempt += 1) {
        openBoard(meta, state, { sid, rules: { ...STANDARD_FORMULA, levelDivisor: 5 }, gear, weapons: { wessel: weapon } });
        const staged = stageExchange(meta, state, [{ who: 'Wessel', kind: 'attack', target: 11 }]);
        if (staged.preview?.result.stop === 'open' && staged.preview.result.wear?.some(event => event.to === 'broken')) { result = staged; break; }
        discardBoard(meta);
    }
    assert.ok(result, 'found a staged weapon break');
    ui.mounts.screen.open('story-block/fight');
    await settle();
    const choice = doc.querySelector('[data-ss-screen="story-block/fight"]').querySelector('[data-choice="1"]');
    assert.match(choice.textContent, /^AttackSTR$/);
    assert.doesNotMatch(choice.textContent, /Cane Sword/);
});
