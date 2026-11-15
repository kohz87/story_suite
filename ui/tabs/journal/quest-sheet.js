// Builds the Edit quest form (title, what it is, step, due date, reward, difficulty, and a ⋯ menu to give up or delete).
import { h } from '../../kit/dom.js';
import { button } from '../../kit/controls.js';

const DIFFICULTIES = ['easy', 'normal', 'hard'];

function field(label, control) {
  return h('label', { class: 'ef' }, label, control);
}

/** Returns only the fields that differ from the quest; a blank title or summary keeps the old text. */
export function questPatch(quest, values) {
  const patch = {};
  const title = (values.title ?? '').trim();
  const summary = (values.summary ?? '').trim();
  if (title && title !== quest.title) patch.title = title;
  if (summary && summary !== quest.summary) patch.summary = summary;
  const step = Number(values.stepIndex);
  if (Number.isInteger(step) && step >= 0 && step < quest.steps.length && step !== quest.stepIndex) patch.stepIndex = step;
  if ('due' in values) {
    const due = (values.due ?? '').trim();
    if ((due || null) !== (quest.due?.date ?? null)) patch.due = due || null;
  }
  if ('reward' in values) {
    const reward = (values.reward ?? '').trim();
    const was = [quest.reward, quest.xp].filter(Boolean).join(' · ');
    if (reward !== was) patch.reward = reward || null;
  }
  if (values.difficulty && values.difficulty !== quest.difficulty) patch.difficulty = values.difficulty;
  return patch;
}

/** Builds the form; `onSave(patch)`, `onGiveUp()`, `onDelete()` and `onClose()` are called by its buttons. Reward and difficulty show only when rpg. */
export function questSheet(quest, { rpg = true, onSave, onGiveUp, onDelete, onClose } = {}) {
  const kind = rpg ? 'quest' : 'task';
  const title = h('input', { type: 'text', value: quest.title });
  const summary = h('textarea', { rows: 3, value: quest.summary });
  const step = h('select', null, quest.steps.map((s, i) => h('option', { value: i, selected: i === quest.stepIndex }, `${i + 1} of ${quest.steps.length} · ${s}`)));
  step.value = String(quest.stepIndex);
  const due = h('input', { type: 'text', value: quest.due?.date ?? '', placeholder: 'No due date' });
  const reward = rpg ? h('input', { type: 'text', value: [quest.reward, quest.xp].filter(Boolean).join(' · '), placeholder: 'None' }) : null;
  const difficulty = rpg ? h('select', null, DIFFICULTIES.map(v => h('option', { value: v, selected: v === quest.difficulty }, v))) : null;
  if (difficulty) difficulty.value = quest.difficulty ?? 'normal';
  const menu = h('div', { class: 'qmore', hidden: true }, button({ label: `Give up this ${kind}`, className: 'giveup', onClick: () => onGiveUp?.() }), button({ label: 'Delete', tone: 'danger', className: 'delete', onClick: () => onDelete?.() }));
  const more = button({ label: '⋯', tone: 'icon', ariaLabel: 'More: give up or delete', className: 'x qmore-btn' });
  more.setAttribute('aria-expanded', 'false');
  more.addEventListener('click', () => {
    const open = menu.hasAttribute('hidden');
    if (open) menu.removeAttribute('hidden');
    else menu.setAttribute('hidden', '');
    more.setAttribute('aria-expanded', String(open));
  });

  function collect() {
    const values = { title: title.value, summary: summary.value, stepIndex: step.value, due: due.value };
    if (reward) values.reward = reward.value;
    if (difficulty) values.difficulty = difficulty.value;
    return values;
  }

  return h(
    'div',
    { class: 'qsheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Edit ${kind}`, dataset: { quest: quest.id } },
    h('div', { class: 'qeh' }, h('div', { class: 'dn' }, `Edit ${kind}`), more, button({ label: '×', tone: 'icon', ariaLabel: 'Close', className: 'x qclose', onClick: () => onClose?.() })),
    menu,
    field('Title', title),
    field('What it is', summary),
    field('Current step', step),
    field('Due (a date, no time)', due),
    reward ? field('Reward', reward) : null,
    difficulty ? field('Difficulty', difficulty) : null,
    h('p', { class: 'fine' }, 'Changes are kept as written by you. The narrator is told the quest as it now stands.'),
    h('div', { class: 'brow' }, button({ label: 'Save', tone: 'primary', className: 'save', onClick: () => onSave?.(questPatch(quest, collect())) }), button({ label: 'Cancel', className: 'cancel', onClick: () => onClose?.() })),
  );
}
