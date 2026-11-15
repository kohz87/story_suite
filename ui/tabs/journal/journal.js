// Composes the Journal tab: a Quests (Tasks) / Calendar switch, then that view's cards with empty cards left out.
import { h } from '../../kit/dom.js';
import { segmented } from '../../kit/controls.js';
import { questsCard, leadsCard, closedCard } from './quests.js';
import { calendarCard } from './calendar.js';
import { comingUp } from './coming-up.js';

/** Builds the Journal tab from a `journal` view-model; ctx = { prefs, go, command, editQuest(quest) }. */
export function journalTab(journal = {}, ctx = {}) {
  const rpg = journal.rpg !== false;
  const body = h('div', { class: 'journal-body' });
  let view = ctx.prefs?.getFold?.('journal.calendar', false) ? 'cal' : 'quests';

  function questView() {
    const cards = [questsCard(journal, ctx), leadsCard(journal), closedCard(journal, ctx)].filter(Boolean);
    return cards.length ? cards : [h('p', { class: 'fine' }, `No ${rpg ? 'quests' : 'tasks'} yet.`)];
  }

  function calendarView() {
    if (!journal.calendar?.months?.length) return [h('p', { class: 'fine' }, 'No calendar yet.')];
    const cal = calendarCard(journal);
    return [cal, comingUp(journal, { onPick: (m, d) => cal.selectDay(m, d) })].filter(Boolean);
  }

  function draw() {
    body.dataset.view = view;
    body.replaceChildren(...(view === 'cal' ? calendarView() : questView()));
  }

  const switcher = segmented({
    items: [['quests', rpg ? 'Quests' : 'Tasks'], ['cal', 'Calendar']],
    value: view,
    label: 'Journal view',
    className: 'wseg glass',
    onChange: v => {
      view = v;
      ctx.prefs?.setFold?.('journal.calendar', v === 'cal');
      draw();
    },
  });
  draw();
  return h('div', { class: 'journal-tab', dataset: { tab: 'journal' } }, switcher, body);
}
