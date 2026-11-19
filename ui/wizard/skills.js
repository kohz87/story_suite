// The wizard's Skills step in the new view: the starting sets (built in and the packs'), then one stacked card of fields per skill (name, what it
// does, stat, type, starts at) and "+ Add a skill", with the old step's words and rules: the draft is changed
// only by wizard-data's withSet / withSkill / withSkillPatch / withoutSkill, so the caps, the one Adept and the signature skills hold as before.

import { h } from '../kit/dom.js';
import { button } from '../kit/controls.js';
import { RANK_NAMES, STATS_V1 as STATS } from '../../modules/rpg/names.js';
import { SKILL_TYPE_NAMES } from '../../modules/rpg/templates-combat.js';
import { V1, RANKS } from '../../modules/rpg/combat/numbers.js';
import { RPG_STRINGS, fill } from '../../modules/rpg/strings.js';
import { CREATION } from '../../modules/rpg/names.js';
import { stanceNote, typeOptions } from './stance.js';
import { START_RANKS, draftSlots, mayStartAdept, readDraft, setLine, skillSetsOf, withSet, withSkill, withSkillPatch, withoutSkill } from '../../modules/rpg/view/wizard-data.js';

const W = RPG_STRINGS.wizard;
const SKILL_TYPES = SKILL_TYPE_NAMES.map(key => ({ value: key, label: V1.skill.types[key].label }));
const RANK_WORDS = RANKS.map(rank => rank.name);
const safe = (fn, fallback) => { try { return fn() ?? fallback; } catch { return fallback; } };

const select = (options, value, label, field) => {
  const node = h('select', { 'aria-label': label, dataset: { field } },
    options.map(option => h('option', { value: String(option.value), disabled: option.disabled === true, selected: String(option.value) === String(value) }, option.label)));
  node.value = String(value);
  return node;
};

// The ask before a set replaces skills a saved file gave (their ranks would go).
function replaceAsk(ctx) {
  const { run } = ctx;
  if (run.pendingSet && !run.draft.skills.some(skill => Number.isSafeInteger(skill.rank))) run.pendingSet = null;
  if (!run.pendingSet) return null;
  return h('div', { class: 'wz-ask', role: 'alert', dataset: { wiz: 'replace' } },
    h('p', { class: 'ps-p' }, W.replaceAsk),
    h('div', { class: 'ps-row' },
      button({ label: W.replaceKeep, dataset: { wiz: 'replace-keep' }, onClick: () => { run.pendingSet = null; ctx.redraw(); } }),
      button({ label: W.replaceYes, tone: 'primary', dataset: { wiz: 'replace-yes' }, onClick: () => { const set = run.pendingSet; run.pendingSet = null; ctx.put(withSet(run.draft, set)); ctx.redraw(); } })));
}

function setButton(ctx, set) {
  const { run } = ctx;
  const used = run.draft.set === set.id;
  const pick = () => {
    if (run.draft.skills.some(skill => Number.isSafeInteger(skill.rank))) { run.pendingSet = set; ctx.redraw(); return; }
    ctx.put(withSet(run.draft, set));
    ctx.redraw();
  };
  // (from 1100 px, once a set is used the sets fold to name chips, wizard.css; the title keeps their skills and words on hover)
  return h('button', { type: 'button', class: 'wz-set', 'aria-pressed': String(used), title: [setLine(set), set.about].filter(Boolean).join('. '), dataset: { set: set.id }, onClick: pick },
    h('span', { class: 'wz-set-top' }, h('b', null, set.name), used ? h('span', { class: 'wz-tag' }, W.used) : null),
    h('small', null, setLine(set)),
    set.about ? h('small', null, set.about) : null,
    h('small', { class: 'wz-src' }, set.source));
}

// The Stat list: a Focus skill rolls with INT or WIS, so the other stats are switched off and say why (its own stat stays, for a file that brought one: Review names it).
const statOptions = skill => STATS.map(key => (skill.type === 'focus' && !V1.focus.stats.includes(key) && key !== skill.stat
  ? { value: key, label: fill(W.focusStatOff, { stat: key.toUpperCase() }), disabled: true } : { value: key, label: key.toUpperCase() }));

function skillCard(ctx, skill, at) {
  const { run } = ctx;
  const label = skill.name || W.newSkill;
  const patch = (value, again = false) => { ctx.put(withSkillPatch(run.draft, at, value)); if (again) ctx.redraw(); else ctx.summary(); };
  const name = h('input', { type: 'text', maxlength: String(CREATION.skillName), 'aria-label': W.skillName, value: skill.name ?? '', dataset: { field: 'name' }, onInput: () => patch({ name: name.value }) });
  const about = h('textarea', { rows: '4', maxlength: String(CREATION.skillAbout), 'aria-label': fill(W.skillAbout, { name: label }), value: skill.about ?? '', dataset: { field: 'about' }, onInput: () => patch({ about: about.value }), onKeydown: event => { if (event.key === 'Enter') event.preventDefault(); } });
  const stat = select([...(skill.stat ? [] : [{ value: '', label: '—' }]), ...statOptions(skill)], skill.stat ?? '', fill(W.skillStat, { name: label }), 'stat');
  const type = select(typeOptions(SKILL_TYPES, run.draft.skills, at), skill.type ?? 'attack', fill(W.skillType, { name: label }), 'type');
  const ranked = Number.isSafeInteger(skill.rank);
  const start = ranked ? select(RANK_WORDS.map((word, rank) => ({ value: rank, label: word, disabled: true })), skill.rank, fill(W.skillStart, { name: label }), 'start')
    : select(START_RANKS.map(rank => ({ value: rank, label: RANK_NAMES[rank], disabled: rank === 1 && !mayStartAdept(run.draft, at), ...(rank === 1 && (run.draft.level ?? 1) < RANKS[2].minLevel ? { label: fill(W.adeptFrom, { rank: RANK_NAMES[rank], level: RANKS[2].minLevel }) } : {}) })), skill.start, fill(W.skillStart, { name: label }), 'start');
  if (ranked) start.disabled = true;
  stat.addEventListener('change', () => patch({ stat: stat.value }));
  type.addEventListener('change', () => patch({ type: type.value }, true));
  start.addEventListener('change', () => patch({ start: Number(start.value) }, true));
  const remove = button({ label: '×', tone: 'default', className: 'wz-x', ariaLabel: fill(W.remove, { name: label }), dataset: { wiz: 'remove' }, onClick: () => { ctx.put(withoutSkill(run.draft, at)); ctx.redraw(); } });
  // A signature skill (a pack's cast member brought it): its name and what it does may be fixed; the rest stays and it cannot be taken out.
  if (skill.sig === true) for (const control of [stat, type, start, remove]) control.disabled = true;
  return h('div', { class: 'wz-skill', dataset: { skill: String(at), signature: skill.sig === true ? 'true' : null } },
    h('div', { class: 'wz-skill-top' }, h('label', { class: 'ef' }, W.colSkill, name), remove),
    h('label', { class: 'ef' }, W.colAbout, about),
    h('div', { class: 'wz-trio' }, h('label', { class: 'ef' }, W.colStat, stat), h('label', { class: 'ef' }, W.colType, type), h('label', { class: 'ef' }, W.colStart, start)));
}

// Which bar a skill draws, from the rule's own numbers (Combat Rules v1: INT/WIS → Mana, any other stat → Stamina; heal → Mana; a stance's cost each exchange).
const barsHint = () => fill(W.barsHint, { magic: V1.skill.magicStats.map(s => s.toUpperCase()).join(' or '), stance: V1.cost.stance });

/** Draws the Skills step for the wizard session `ctx` ({ run, world, put, summary, redraw }). */
export function drawSkills(ctx) {
  const { run, world } = ctx;
  const now = readDraft(run.draft);
  const sets = skillSetsOf({
    packSets: safe(() => world.query('packs.content', { kind: 'rpg' }), []),
    packNames: Object.fromEntries((safe(() => world.query('packs.list'), []) ?? []).map(pack => [pack.id, pack.name])),
  });
  const left = draftSlots(now) - now.skills.length;
  return h('div', { class: 'wz-skills' },
    replaceAsk(ctx),
    h('p', { class: 'ps-p' }, fill(W.skillsIntro, { max: draftSlots(run.draft) })),
    h('p', { class: 'ps-p', dataset: { wiz: 'bars-hint' } }, barsHint()),
    h('div', { class: 'ps-sec' }, W.templates),
    h('div', { class: 'wz-sets' }, sets.map(set => setButton(ctx, set))),
    h('div', { class: 'ps-sec' }, W.yourSkills),
    run.draft.skills.some(skill => Number.isSafeInteger(skill.rank)) ? h('p', { class: 'ps-p' }, W.importRanks) : null,
    run.draft.skills.some(skill => skill.sig === true) ? h('p', { class: 'ps-p' }, W.signatureNote) : null,
    stanceNote(run.draft.skills) ? h('p', { class: 'ps-p', role: 'status', dataset: { wiz: 'stance-note' } }, stanceNote(run.draft.skills)) : null,
    // (one card under the other on a phone, two to a row from 1100 px)
    run.draft.skills.length ? h('div', { class: 'wz-cards' }, run.draft.skills.map((skill, at) => skillCard(ctx, skill, at))) : null,
    h('div', { class: 'wz-add' },
      button({ label: W.add, disabled: left <= 0, dataset: { wiz: 'add' }, onClick: () => { ctx.put(withSkill(run.draft)); ctx.redraw(); } }),
      h('p', { class: 'ps-p' }, `${left <= 0 ? W.slotsFull : left === 1 ? W.slotLeft : fill(W.slotsLeft, { n: left })} ${W.skillsNoteStandard}`)));
}
