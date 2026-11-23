// Adapted from ui/wizard/review.js (keep in step when that file changes). The wizard's Review step for Text RPG: everything at a glance, what stops Create, and Create itself, which sends
// `textRpg.create` through the widget's api (a made character closes the sheet; a refusal is shown as the command said it).
import { h } from '../kit/dom.js';
import { button } from '../kit/controls.js';
import { payloadOf, problemsOf } from './draft.js';
import { SKILL_TYPES } from './rules.js';
import { W, fill, statsLine } from './words.js';

const typeWord = value => SKILL_TYPES.find(type => type.value === value)?.label ?? value;
const costWord = skill => (skill.pool ? ` · ${W.costs} ${skill.n} ${skill.pool === 'mp' ? W.mana : W.stamina}` : '');

async function create(ctx, make, status) {
  const { run } = ctx;
  if (run.busy || !run.alive) return;
  run.busy = true;
  run.message = '';
  make.disabled = true;
  make.textContent = W.creating;
  status.textContent = '';
  const payload = payloadOf(run.draft);
  let result = null;
  try { result = await ctx.command('textRpg.create', payload); } catch { result = null; }
  run.busy = false;
  if (result?.ok) { run.created = true; ctx.close(); return; }
  run.message = result?.message ?? W.generic;
  if (run.alive) { make.disabled = false; make.textContent = W.create; status.textContent = run.message; }
}

/** Draws the Review step for the wizard session `ctx` ({ run, command, close }). */
export function drawReview(ctx) {
  const { run } = ctx;
  const draft = run.draft;
  const problems = problemsOf(draft);
  const skills = draft.skills.length ? draft.skills.map(skill => h('li', null, `${skill.name || '—'} · ${skill.stat.toUpperCase()} · ${typeWord(skill.type)}${costWord(skill)}`)) : [h('li', null, W.noSkills)];
  const status = h('p', { class: 'ps-p wz-status', role: 'status' }, run.message);
  const make = button({ label: run.busy ? W.creating : W.create, tone: 'primary', disabled: problems.length > 0 || run.busy, dataset: { wiz: 'create' }, onClick: () => create(ctx, make, status) });
  return h('div', { class: 'wz-review' },
    h('div', { class: 'ps-sec' }, W.reviewHead),
    h('dl', { class: 'ps-kv' },
      h('dt', null, W.name), h('dd', { dataset: { review: 'who' } }, fill(W.reviewWho, { name: draft.name.trim() || '—', kind: W.you })),
      h('dt', null, W.statsHead), h('dd', null, statsLine(draft.stats)),
      h('dt', null, W.skillsHead), h('dd', null, h('ul', { class: 'wz-list' }, skills))),
    h('ul', { class: 'wz-problems', role: 'alert', hidden: problems.length === 0 },
      problems.length ? h('li', { class: 'wz-problems-head' }, W.problems) : null,
      problems.map(problem => h('li', null, problem))),
    h('div', { class: 'ps-row' }, make),
    status);
}
