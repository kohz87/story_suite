// Builds the Quests (Tasks when RPG is off), Leads and Closed cards with focus star and Edit button on each quest.
import { h } from '../../kit/dom.js';

const OUTCOME = { done: 'done', failed: 'failed', gaveup: 'given up', declined: 'declined', lapsed: 'lapsed' };

function send(ctx, type, payload) {
  const fn = ctx?.command ?? (ctx?.port ? ctx.port.command.bind(ctx.port) : null);
  return fn ? fn(type, payload) : null;
}

function kv(label, ...value) {
  return [h('dt', null, label), h('dd', null, value)];
}

function questCard(q, state, ctx, rpg) {
  const focus = q.id === state.focusId;
  const late = q.due?.state === 'late';
  const dots = q.stepCount > 1
    ? h('div', { class: 'sdots' }, Array.from({ length: q.stepCount }, (_, i) => h('i', { class: i < q.stepIndex ? 'on' : null })), h('span', null, `step ${q.stepIndex + 1} of ${q.stepCount}`))
    : null;
  const reward = q.reward ?? '';
  const giver = q.giver?.name
    ? [
      q.giver.portrait ? h('span', { class: 'av', dataset: { portrait: q.giver.portrait } }) : null,
      q.giver.personId && ctx?.go
        ? h('button', { type: 'button', class: 'lk', onClick: () => ctx.go('people', { personId: q.giver.personId }) }, q.giver.name)
        : h('span', { class: 'lk-plain' }, q.giver.name),
    ]
    : null;
  return h(
    'div',
    { class: ['qc', focus ? 'focus' : null, late ? 'over' : null], dataset: { quest: q.id } },
    h(
      'div',
      { class: 'qh' },
      h('button', {
        type: 'button', class: ['fstar', focus ? 'on' : null], 'aria-pressed': String(focus),
        'aria-label': `${focus ? 'In focus' : 'Put in focus'}: ${q.title}`,
        title: focus ? 'In focus: shown first here and on Now' : 'Put in focus',
        onClick: () => state.setFocus(focus ? null : q.id),
      }, focus ? '◆' : '◇'),
      h('b', null, q.title),
      h('span', { class: ['qst', late ? 'failed' : null] }, late ? 'overdue' : 'under way'),
      h('button', { type: 'button', class: 'qedit', 'aria-label': `Edit ${q.title}`, onClick: () => ctx?.editQuest?.(q) }, 'Edit'),
    ),
    q.summary ? h('p', null, q.summary) : null,
    q.step ? h('div', { class: 'step' }, h('span', { class: 'si2' }, q.stepIndex + 1), h('span', null, q.step)) : null,
    dots,
    h(
      'dl',
      { class: 'qkv' },
      giver ? kv('From', ...giver) : null,
      q.due ? kv('Due', q.due.date, ' ', h('span', { class: ['due', q.due.state] }, q.due.rel)) : null,
      q.trip ? kv('Trip', q.trip) : null,
      rpg && reward ? kv('Reward', reward) : null,
      rpg && q.difficulty ? kv('Difficulty', q.difficulty) : null,
    ),
  );
}

/** Builds the Quests card (Tasks when RPG is off); focus only changes order. Null when nothing is under way. */
export function questsCard(journal, ctx = {}) {
  const quests = Array.isArray(journal?.quests) ? journal.quests : [];
  if (!quests.length) return null;
  const rpg = journal.rpg !== false;
  const grid = h('div', { class: 'qgrid' });
  const state = {
    focusId: journal.focusId ?? null,
    setFocus(id) {
      state.focusId = id;
      send(ctx, 'quest.focus', { id });
      draw();
    },
  };
  function draw() {
    const rows = quests.map((q, i) => [q, i]).sort((a, b) => (b[0].id === state.focusId) - (a[0].id === state.focusId) || a[1] - b[1]);
    grid.replaceChildren(...rows.map(([q]) => questCard(q, state, ctx, rpg)));
  }
  draw();
  return h(
    'section',
    { class: 'card glass', dataset: { card: 'quests' } },
    h('div', { class: 'ch' }, h('h3', null, rpg ? 'Quests' : 'Tasks'), h('span', { class: 'cnt' }, `${quests.length} under way`)),
    grid,
  );
}

/** Builds the Leads card (offers not taken yet), or null when there are none. */
export function leadsCard(journal) {
  const leads = Array.isArray(journal?.leads) ? journal.leads : [];
  if (!leads.length) return null;
  return h(
    'section',
    { class: 'card glass', dataset: { card: 'leads' } },
    h('div', { class: 'ch' }, h('h3', null, 'Leads'), h('span', { class: 'cnt' }, `${leads.length} not taken`)),
    h('div', null, leads.map(l => h(
      'div',
      { class: 'lead2' },
      h('span', { class: 'a' }, (l.from || '?')[0]),
      h('span', null, h('b', null, l.title), h('small', null, `${l.from} · ${l.where}`), h('small', { class: 'lapse' }, `lapses ${l.lapses}`)),
    ))),
    h('p', { class: 'fine' }, 'You take a lead by saying so in the story. An offer lapses at its deadline, or 2 days later if you spoke of it.'),
  );
}

/** Builds the Closed card (done, failed, given up, declined, lapsed) folded by default; the fold is kept per device. */
export function closedCard(journal, ctx = {}) {
  const closed = Array.isArray(journal?.closed) ? journal.closed : [];
  if (!closed.length) return null;
  const rpg = journal.rpg !== false;
  const list = h('div', { class: 'closed' }, closed.map(c => h(
    'div',
    { class: 'cq' },
    h('b', null, c.title),
    h('span', { class: ['qst', c.outcome] }, OUTCOME[c.outcome] ?? c.outcome),
    h('small', null, rpg && c.paid ? `${c.detail} · ${c.paid}` : c.detail),
  )));
  let open = Boolean(ctx.prefs?.getFold?.('journal.closed', false));
  const fold = h('button', { type: 'button', class: 'fold', onClick: () => { open = !open; ctx.prefs?.setFold?.('journal.closed', open); paint(); } }, h('i', null, '›'), 'Closed ', h('small', null, closed.length));
  const root = h('section', { class: 'card glass', dataset: { card: 'closed' } }, fold);
  function paint() {
    fold.setAttribute('aria-expanded', String(open));
    root.replaceChildren(...(open ? [fold, list] : [fold]));
  }
  paint();
  return root;
}
