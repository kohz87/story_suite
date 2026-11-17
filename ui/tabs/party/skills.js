// Builds the Skills list (glyph, kind line, rank pill, seven-step mastery bar) and the one-skill sheet.
import { h } from '../../kit/dom.js';
import { glyph } from '../../kit/glyphs.js';
import { openSheet } from './slot-picker.js';
import { can } from '../../runtime/can.js';

const KIND_LABEL = { attack: 'Attack', area: 'Area attack', magic: 'Magic attack', heal: 'Heal', stance: 'Stance' };
const KIND_GLYPH = { attack: 'atk', area: 'area', magic: 'bolt', heal: 'heal', stance: 'stance' };
const RESOURCE = { stamina: 'Stamina', mana: 'Mana' };

const glyphOf = skill => (glyph(skill.glyph) ? skill.glyph : KIND_GLYPH[skill.kind] ?? 'atk');
const costText = s => `${s.cost} ${RESOURCE[s.resource] ?? s.resource}${s.kind === 'stance' ? ' each exchange' : ''}`;

function masteryBar(mastery, extra) {
  return h(
    'span',
    { class: ['mbar', extra], role: 'img', 'aria-label': `Mastery ${mastery} of 7` },
    [1, 2, 3, 4, 5, 6, 7].map(n => h('i', { class: n <= mastery ? 'on' : null })),
  );
}

/** Opens the sheet for one skill: kind, stat, cost, rank with mastery, and Edit skill. */
export function skillSheet(member, skill, ctx = {}) {
  const sheet = openSheet(ctx, { title: skill.name, subtitle: `${member.name} · ${skill.rank}` });
  const edit = h('button', {
    type: 'button',
    class: 'ps-b',
    onClick: async () => { await ctx.port?.command('rpg.skill.edit', { member: member.id, skill: skill.name }); sheet.close(); },
  }, 'Edit skill');
  sheet.body.replaceChildren(
    h('div', { class: 'ps-i' },
      h('span', { class: 'ti' }, glyph(glyphOf(skill))),
      h('div', null, h('div', { class: 'ps-n ps-n2' }, KIND_LABEL[skill.kind] ?? skill.kind), h('div', { class: 'ps-s' }, `${skill.stat} · ${costText(skill)}`))),
    h('dl', { class: 'ps-kv' }, h('dt', null, 'Rank'), h('dd', null, `${skill.rank}, mastery ${skill.mastery} of 7 `, masteryBar(skill.mastery, 'inline'))),
    can(ctx, 'rpg.skill.edit') ? h('div', { class: 'ps-row' }, edit) : null,
  );
  return sheet;
}

function skillRow(member, skill, ctx) {
  return h(
    'button',
    { type: 'button', class: ['sk', skill.kind === 'stance' ? 'stance' : null], dataset: { skill: skill.name }, onClick: () => skillSheet(member, skill, ctx) },
    h('span', { class: 'ti' }, glyph(glyphOf(skill))),
    h('span', null, h('b', null, skill.name), h('small', null, skill.line ?? `${KIND_LABEL[skill.kind] ?? skill.kind} · ${skill.stat} · ${costText(skill)}`)),
    h('span', { class: 'skr' }, h('span', { class: 'rk' }, skill.rank), masteryBar(skill.mastery)),
  );
}

/** Builds the Skills block for a member (heading with count and Edit, then the rows), or null when there are none. */
export function skillsCard(member, ctx = {}) {
  const skills = member.skills ?? [];
  if (!skills.length) return null;
  const edit = h('button', {
    type: 'button',
    class: 'edit',
    onClick: () => ctx.port?.command('rpg.skill.edit', { member: member.id }),
  }, 'Edit');
  return h(
    'div',
    { class: 'skills-col' },
    h('div', { class: 'secl' }, `Skills · ${skills.length}`, can(ctx, 'rpg.skill.edit') ? edit : null),
    h('div', { class: 'skl' }, skills.map(s => skillRow(member, s, ctx))),
  );
}
