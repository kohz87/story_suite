import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectDrawer, selectReplyMenu, replyLines } from '../../../ui/select/chat.js';
import { selectReplyActions } from '../../../ui/select/reply-actions.js';
import { CHAT_SHAPE } from '../../../ui/contract/chat.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { ANSWERS } from './recorded.js';

describe('selectDrawer', () => {
  it('cuts a place name over 40 characters with "…" (it said "…House of the" with no mark: FIXBATCH3)', () => {
    const name = 'Grand Exchange-and-Counting-House of the Upper Riverbank Merchants Confederacy';
    const [row] = selectDrawer({ 'npc.present': ['Marrit'], 'scene.place': { name } });
    assert.equal(row.where, 'Grand Exchange-and-Counting-House of th…');
    assert.equal(row.where.length, 40);
    const emoji = selectDrawer({ 'npc.present': ['Marrit'], 'scene.place': { name: 'At the 🏛️ Grand Exchange-and-Counting-House of the Upper Riverbank' } })[0].where;
    assert.ok(emoji.length <= 40 && emoji.endsWith('…') && emoji.includes('🏛'), `the contract's 40 units, whole characters: ${emoji}`);
    assert.equal(selectDrawer({ 'npc.present': ['Marrit'], 'scene.place': { name: 'Bluewatch' } })[0].where, 'Bluewatch');
  });

  it('builds one row per present person and matches the contract', () => {
    const rows = selectDrawer(ANSWERS, { portraits: { Fenna: 'fenna.webp' } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].personId, 'np_fenna');
    assert.equal(rows[0].mood, 'wary');
    assert.equal(rows[0].meters.trust, 40);
    assert.equal(rows[0].thought, 'He is late again.');
    assert.equal(rows[0].portrait, 'fenna.webp');
    assert.equal(rows[0].where, 'Guild Office');
  });

  it('is empty when nobody is present, and takes plain names', () => {
    assert.deepEqual(selectDrawer({}), []);
    const rows = selectDrawer({ 'npc.present': ['Wessel'], 'npc.cast': [{ key: 'w', name: 'Wessel', bars: [{ id: 'trust', value: 9 }] }] });
    assert.equal(rows[0].meters.trust, 9);
    assert.equal(rows[0].meters.desire, 0);
    assert.equal(rows[0].portrait, null);
    assert.equal(rows[0].thought, null);
  });
});

describe('replyLines', () => {
  it('lists applied lines then lines not applied', () => {
    const lines = replyLines(ANSWERS);
    assert.deepEqual(lines.map(line => line.line), ['+1 Rope', '+30 copper', 'To Auvoth', 'Fenna arrived', '+ item Moon Blade']);
    assert.equal(lines.at(-1).applied, false);
    assert.equal(lines.at(-1).detail, 'No such item.');
  });

  it('returns null when no reply answer is there', () => {
    assert.equal(replyLines({}), null);
  });
});

describe('selectReplyActions', () => {
  it('builds the newest reply\'s action line and matches the contract', () => {
    const answers = { ...ANSWERS, 'rpg.sheet': [{ name: 'Astra', points: 2 }, { name: 'Ren', points: 0 }], 'rpg.joinsOpen': [{ name: 'Mara' }] };
    const actions = selectReplyActions(answers, { fightOpen: true, offers: [{ state: 'offer' }, { state: 'done' }], unrecorded: true });
    assert.deepEqual(checkShape(actions, CHAT_SHAPE.head.$nullable.actions), []);
    assert.deepEqual(actions.overdue.n, 1);
    assert.deepEqual(actions.points, { n: 2, who: ['Astra'] });
    assert.deepEqual(actions.joins, ['Mara']);
    assert.equal(actions.offers, 1);
    assert.equal(actions.fight, true);
    assert.equal(actions.unrecorded, true);
  });

  it('has nothing to do when those answers are missing', () => {
    assert.deepEqual(selectReplyActions({}), { fight: false, loot: [], points: null, overdue: null, joins: [], offers: 0, unrecorded: false });
  });
});

describe('selectReplyMenu repaired', () => {
  it('carries the repaired word and each line\'s assist mark; a repaired reply with no shown line keeps its sheet so it can be discarded', () => {
    const answers = { 'reply.changes': { lines: [{ glyph: 'item', line: '+1 Rope', detail: null, applied: true, assist: true }, { glyph: 'coin', line: '−5', applied: true }], refused: [], stateThen: { place: 'Mill' } } };
    const menu = selectReplyMenu(answers, { repaired: true });
    assert.equal(menu.repaired, true);
    assert.deepEqual(menu.lines.map(line => line.assist), [true, false]);
    assert.equal(selectReplyMenu(answers, {}).repaired, false);
    assert.deepEqual(selectReplyMenu({}, { repaired: true }).lines, []);
    assert.equal(selectReplyMenu({}, {}), null);
  });
});

describe('selectReplyMenu', () => {
  it('builds the menu with counts and the state then', () => {
    const menu = selectReplyMenu(ANSWERS, { at: 'Reply 12' });
    assert.deepEqual(checkShape(menu, CHAT_SHAPE.replyMenu), []);
    assert.deepEqual(menu.counts, { changes: 4, heldBack: 1, notApplied: 1 });
    assert.deepEqual(menu.stateThen, { place: 'Guild Office', weather: 'cold drizzle' });
  });

  it('is null without reply answers', () => {
    assert.equal(selectReplyMenu({}), null);
  });
});
