// Adapted from ui/wizard/skills.js (keep in step when that file changes). The wizard's Skills step for Text RPG: one stacked card of fields per skill (name, what it does, stat, type, what it
// costs) and "+ Add a skill", up to the slots of the level (5 at the start, one more every tenth level, 8 at most). There are no starting sets or stances here.
import { h } from '../kit/dom.js';
import { button } from '../kit/controls.js';
import { STAT_KEYS } from '../words/stats.js';
import { skillLimit } from './limits.js';
import { COST_POOLS, RULES, SKILL_TYPES } from './rules.js';
import { W, fill } from './words.js';

const select = (options, value, label, field) => {
  const node = h('select', { 'aria-label': label, dataset: { field } }, options.map(option => h('option', { value: String(option.value), selected: String(option.value) === String(value) }, option.label)));
  node.value = String(value);
  return node;
};

function skillCard(ctx, skill, at) {
  const { run } = ctx;
  const label = skill.name || W.newSkill;
  const patch = (value, again = false) => {
    ctx.put({ ...run.draft, skills: run.draft.skills.map((one, index) => (index === at ? { ...one, ...value } : one)) });
    if (again) ctx.redraw(); else ctx.summary();
  };
  const name = h('input', { type: 'text', maxlength: String(RULES.nameMax), 'aria-label': W.skillName, value: skill.name, dataset: { field: 'name' }, onInput: () => patch({ name: name.value }) });
  const about = h('textarea', { rows: '4', maxlength: '600', 'aria-label': fill(W.skillAbout, { name: label }), value: skill.about, dataset: { field: 'about' }, onInput: () => patch({ about: about.value }), onKeydown: event => { if (event.key === 'Enter') event.preventDefault(); } });
  const stat = select(STAT_KEYS.map(key => ({ value: key, label: key.toUpperCase() })), skill.stat, fill(W.skillStat, { name: label }), 'stat');
  const type = select(SKILL_TYPES, skill.type, fill(W.skillType, { name: label }), 'type');
  const pool = select(COST_POOLS, skill.pool, fill(W.skillCost, { name: label }), 'cost');
  stat.addEventListener('change', () => patch({ stat: stat.value }));
  type.addEventListener('change', () => patch({ type: type.value }));
  pool.addEventListener('change', () => patch({ pool: pool.value }, true));
  const n = skill.pool ? h('input', { type: 'number', min: '1', max: String(RULES.costMax), step: '1', inputmode: 'numeric', 'aria-label': fill(W.skillCostN, { name: label }), value: String(skill.n), dataset: { field: 'cost-n' },
    onInput: () => patch({ n: Number.parseInt(n.value, 10) || 1 }) }) : null;
  const remove = button({ label: '×', className: 'wz-x', ariaLabel: fill(W.remove, { name: label }), dataset: { wiz: 'remove' }, onClick: () => { ctx.put({ ...run.draft, skills: run.draft.skills.filter((_, index) => index !== at) }); ctx.redraw(); } });
  return h('div', { class: 'wz-skill', dataset: { skill: String(at) } },
    h('div', { class: 'wz-skill-top' }, h('label', { class: 'ef' }, W.colSkill, name), remove),
    h('label', { class: 'ef' }, W.colAbout, about),
    h('div', { class: 'wz-trio' }, h('label', { class: 'ef' }, W.colStat, stat), h('label', { class: 'ef' }, W.colType, type), h('label', { class: 'ef' }, W.colCost, pool)),
    n ? h('label', { class: 'ef' }, W.colCostN, n) : null);
}

/** Draws the Skills step for the wizard session `ctx` ({ run, put, summary, redraw }). */
export function drawSkills(ctx) {
  const { run } = ctx;
  const max = skillLimit(run.draft), left = max - run.draft.skills.length;
  return h('div', { class: 'wz-skills' },
    h('p', { class: 'ps-p' }, fill(W.skillsIntro, { max })),
    h('div', { class: 'ps-sec' }, W.yourSkills),
    run.draft.skills.length ? h('div', { class: 'wz-cards' }, run.draft.skills.map((skill, at) => skillCard(ctx, skill, at))) : null,
    h('div', { class: 'wz-add' },
      button({ label: W.add, disabled: left <= 0, dataset: { wiz: 'add' }, onClick: () => { ctx.put({ ...run.draft, skills: [...run.draft.skills, run.draft.skill()] }); ctx.redraw(); } }),
      h('p', { class: 'ps-p' }, left <= 0 ? W.slotsFull : left === 1 ? W.slotLeft : fill(W.slotsLeft, { n: left }))));
}
