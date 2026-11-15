import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../../helpers/dom.js';
import { buildJournal } from '../../../../ui/fixtures/journal.js';
import { createPrefs } from '../../../../ui/runtime/prefs.js';
import { journalTab } from '../../../../ui/tabs/journal/journal.js';

const cards = el => el.querySelectorAll('[data-card]').map(c => c.dataset.card);

test('opens on Quests with the cards in order and the switch labelled Quests / Calendar', () => {
  installFakeDom();
  const el = journalTab(buildJournal(), { prefs: createPrefs({ chatId: 'j' }) });
  assert.deepEqual(el.querySelectorAll('.wseg button').map(b => b.textContent), ['Quests', 'Calendar']);
  assert.equal(el.querySelector('.wseg button[aria-pressed="true"]').textContent, 'Quests');
  assert.deepEqual(cards(el), ['quests', 'leads', 'closed']);
  assert.equal(el.dataset.tab, 'journal');
});

test('Calendar shows the calendar card then Coming up, and Coming up rows pick the day', () => {
  installFakeDom();
  const el = journalTab(buildJournal(), {});
  el.querySelectorAll('.wseg button')[1].click();
  assert.deepEqual(cards(el), ['calendar', 'coming-up']);
  el.querySelector('.up[data-sel="6,16"]').click();
  assert.match(el.querySelector('.dph').textContent, /Goldwane 16/);
  assert.equal(el.querySelector('.cd.sel b').textContent, '16');
  el.querySelectorAll('.wseg button')[0].click();
  assert.deepEqual(cards(el), ['quests', 'leads', 'closed']);
});

test('the chosen view is remembered per device', () => {
  installFakeDom();
  const prefs = createPrefs({ chatId: 'j' });
  journalTab(buildJournal(), { prefs }).querySelectorAll('.wseg button')[1].click();
  assert.equal(journalTab(buildJournal(), { prefs }).querySelector('.journal-body').dataset.view, 'cal');
});

test('with RPG off the first view is called Tasks', () => {
  installFakeDom();
  const el = journalTab(buildJournal({ rpg: false }), {});
  assert.equal(el.querySelector('.wseg button').textContent, 'Tasks');
  assert.equal(el.querySelector('[data-card="quests"] h3').textContent, 'Tasks');
});

test('empty cards are left out and a fully empty journal says so, in both views', () => {
  installFakeDom();
  const j = buildJournal({ empty: true });
  const el = journalTab(j, {});
  assert.deepEqual(cards(el), []);
  assert.match(el.textContent, /No quests yet/);
  el.querySelectorAll('.wseg button')[1].click();
  assert.deepEqual(cards(el), ['calendar']);
  const bare = journalTab({ rpg: false }, {});
  assert.match(bare.textContent, /No tasks yet/);
  bare.querySelectorAll('.wseg button')[1].click();
  assert.match(bare.textContent, /No calendar yet/);
  assert.deepEqual(cards(journalTab({ ...buildJournal(), leads: [], closed: [] }, {})), ['quests']);
  journalTab(undefined);
});

test('Edit on a quest reaches ctx.editQuest through the composed tab', () => {
  installFakeDom();
  const edited = [];
  const el = journalTab(buildJournal(), { editQuest: q => edited.push(q.id) });
  el.querySelector('[data-quest="harb"] .qedit').click();
  assert.deepEqual(edited, ['harb']);
});
