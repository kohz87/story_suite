// Builds the Skills list (glyph, kind line, rank pill, seven-step mastery bar, practice to the next rank) and the one-skill sheet.
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { openSheet } from './slot-picker.js';
import { can } from '../../runtime/can.js';

const KIND_LABEL = { attack: 'Attack', area: 'Area attack', magic: 'Magic attack', heal: 'Heal', stance: 'Stance' };
const KIND_GLYPH = { attack: 'atk', area: 'area', magic: 'bolt', heal: 'heal', stance: 'stance' };
const RESOURCE = { stamina: 'Stamina', mana: 'Mana' };

const glyphOf = skill => (glyph(skill.glyph) ? skill.glyph : KIND_GLYPH[skill.kind] ?? 'atk');
const editName = member => (typeof member?.commands?.skillEdit === 'string' ? member.commands.skillEdit : 'rpg.skill.edit');
const text = v => (typeof v === 'string' ? v.trim() : '');
// The cost, or nothing when the view has none: 0 means a story-only skill; a cost or resource the view left out is never printed.
function costText(s) {
  if (!Number.isFinite(s.cost)) return '';
  if (s.cost === 0) return 'Story only';
  const pool = text(RESOURCE[s.resource] ?? s.resource);
  return `${s.cost}${pool ? ` ${pool}` : ''}${s.kind === 'stance' ? ' each exchange' : ''}`;
}
const kindText = s => (s.kind === 'stance' && text(s.stance) ? `${text(s.stance)} stance` : text(KIND_LABEL[s.kind] ?? s.kind));
const factsText = s => [text(s.stat), costText(s)].filter(Boolean).join(' · ');
const rowText = s => text(s.line) || [kindText(s), text(s.stat), costText(s)].filter(Boolean).join(' · ');

// The practice toward the next rank: "34/100" (this rank's share), "Max" at the top; the sheet's line names the rank and a level it still needs.
const toNext = s => (s.next ? `${Math.max(0, (s.practice ?? 0) - s.next.from)}/${s.next.at - s.next.from}` : Number.isFinite(s.practice) ? 'Max' : '');
const nextLine = s => (s.next ? `${s.practice ?? 0} of ${s.next.at} to ${s.next.name}${s.next.levelOk ? '' : ` (needs level ${s.next.minLevel})`}` : 'Highest rank');

function masteryBar(mastery, extra) {
  return h(
    'span',
    { class: ['mbar', extra], role: 'img', 'aria-label': `Mastery ${mastery} of 7` },
    [1, 2, 3, 4, 5, 6, 7].map(n => h('i', { class: n <= mastery ? 'on' : null })),
  );
}

/** Opens the sheet for one skill: kind, stat, cost, rank with mastery, and Edit skill. */
export function skillSheet(member, skill, ctx = {}) {
  const sheet = openSheet(ctx, { title: skill.name, subtitle: [member.name, text(skill.rank)].filter(Boolean).join(' · ') });
  const edit = h('button', {
    type: 'button',
    class: 'ps-b',
    onClick: async () => { await ctx.port?.command(editName(member), { member: member.id, skill: skill.name }); sheet.close(); },
  }, 'Edit skill');
  sheet.body.replaceChildren(...[
    h('div', { class: 'ps-i' },
      h('span', { class: 'ti' }, glyph(glyphOf(skill))),
      h('div', null, h('div', { class: 'ps-n ps-n2' }, kindText(skill)), h('div', { class: 'ps-s' }, factsText(skill)))),
    text(skill.about) ? h('p', { class: 'ps-p' }, text(skill.about)) : null,
    text(skill.rank) && Number.isFinite(skill.mastery)
      ? h('dl', { class: 'ps-kv' }, h('dt', null, 'Rank'), h('dd', null, `${skill.rank}, mastery ${skill.mastery} of 7 `, masteryBar(skill.mastery, 'inline')),
        Number.isFinite(skill.practice) ? [h('dt', null, 'Practice'), h('dd', null, nextLine(skill))] : null)
      : null,
    can(ctx, editName(member)) ? h('div', { class: 'ps-row' }, edit) : null,
  ].filter(Boolean));
  return sheet;
}

function skillRow(member, skill, ctx) {
  return h(
    'button',
    { type: 'button', class: ['sk', skill.kind === 'stance' ? 'stance' : null], dataset: { skill: skill.name }, onClick: () => skillSheet(member, skill, ctx) },
    h('span', { class: 'ti' }, glyph(glyphOf(skill))),
    h('span', null, h('b', null, skill.name), h('small', null, rowText(skill))),
    h('span', { class: 'skr' }, h('span', { class: 'rk' }, text(skill.rank)), masteryBar(skill.mastery), toNext(skill) ? h('small', { class: 'skp', title: nextLine(skill) }, toNext(skill)) : null),
  );
}

/** Builds the Skills block for a member (heading with count and Edit, then the rows), or null when there are none. */
export function skillsCard(member, ctx = {}) {
  const skills = member.skills ?? [];
  if (!skills.length) return null;
  const edit = h('button', {
    type: 'button',
    class: 'edit',
    onClick: () => ctx.port?.command(editName(member), { member: member.id }),
  }, 'Edit');
  return h(
    'div',
    { class: 'skills-col' },
    h('div', { class: 'secl' }, `Skills · ${skills.length}`, can(ctx, editName(member)) ? edit : null),
    h('div', { class: 'skl' }, skills.map(s => skillRow(member, s, ctx))),
  );
}
