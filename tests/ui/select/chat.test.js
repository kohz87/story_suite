import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectDrawer, selectInlineRow, selectReplyMenu, replyLines } from '../../../ui/select/chat.js';
import { CHAT_SHAPE } from '../../../ui/contract/chat.js';
import { checkShape } from '../../../ui/contract/shapes.js';
import { ANSWERS } from './recorded.js';

describe('selectDrawer', () => {
  it('builds one row per present person and matches the contract', () => {
    const rows = selectDrawer(ANSWERS, { portraits: { Fenna: 'fenna.webp' } });
    assert.deepEqual(checkShape(rows, CHAT_SHAPE.drawer), []);
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
    assert.deepEqual(lines.map(line => line.line), ['+1 Rope', '+30', 'To Auvoth', 'Fenna arrived', '+ item Moon Blade']);
    assert.equal(lines.at(-1).applied, false);
    assert.equal(lines.at(-1).detail, 'No such item.');
  });

  it('returns null when no reply answer is there', () => {
    assert.equal(replyLines({}), null);
  });
});

describe('selectInlineRow', () => {
  it('builds the row and matches the contract', () => {
    const row = selectInlineRow(ANSWERS, { fightOpen: true });
    assert.deepEqual(checkShape(row, CHAT_SHAPE.inlineRow), []);
    assert.equal(row.money.short, '15g 4s 6c');
    assert.equal(row.changes, 4);
    assert.equal(row.notApplied, 1);
    assert.deepEqual(row.needsYou, { n: 1, title: '1 overdue' });
    assert.equal(row.fightOpen, true);
  });

  it('gives null money and needs-you when those answers are missing', () => {
    const row = selectInlineRow({});
    assert.equal(row.money, null);
    assert.equal(row.needsYou, null);
    assert.equal(row.fightOpen, false);
    assert.equal(selectInlineRow({ 'inventory.wallet': { coin: 5 } }).money.short, '5g');
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
