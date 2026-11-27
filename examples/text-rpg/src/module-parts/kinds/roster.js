// The roster lines: `+ skill Who — Name | stat | type | from: how` and `+ companion Name | level: N | strengths: a, b`.
import { DOMAIN, LIMITS, newMember } from '../../domain/shape.js';
import { companionId } from '../../domain/member-id.js';
import { requireActive } from '../active.js';
import { nextLearned } from '../learned.js';
import { memberNamed, skillIndex, skillSlots } from '../members.js';
import { partsOf, labelOf, statKey } from '../line-read.js';
import { levelOf } from '../standing.js';
import { target } from './target.js';

const TYPES = ['attack', 'defence', 'movement', 'magic', 'social', 'craft', 'utility'];

export function applySkill(ctx, line) {
    const { member } = target(ctx, line);
    if (member.companion) ctx.fail('REFUSED', `${member.name} has no sheet; skills are for the reader's character.`);
    const [name, stat, type] = partsOf(line);
    const clean = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, LIMITS.name);
    if (!clean) ctx.fail('INVALID', 'A skill needs a name.');
    if (skillIndex(member, clean) >= 0) ctx.fail('INVALID', `${member.name} already has ${clean}.`);
    const key = statKey(labelOf(line, 'stat') || stat);
    if (!key) ctx.fail('INVALID', 'A skill needs a stat: str, vit, agi, dex, int, wis or cha.');
    if (member.skills.length >= skillSlots(levelOf(member))) ctx.fail('LIMITED', `${member.name} has no free skill slot.`);
    const kind = (labelOf(line, 'type') || type || 'utility').toLowerCase();
    const cost = /^(\d+)\s*(mp|sp)$/i.exec(labelOf(line, 'cost'));
    member.skills.push({
        learned: nextLearned(member),
        name: clean, about: (labelOf(line, 'about') || labelOf(line, 'from')).slice(0, LIMITS.about), stat: key,
        type: TYPES.includes(kind) ? kind : 'utility', cost: cost ? { pool: cost[2].toLowerCase(), n: Number(cost[1]) } : null,
    });
    return { summary: `${member.name} learns ${clean}.`, narrate: true, data: { member: member.id, skill: clean } };
}

export function applyCompanion(ctx, line) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const asked = Math.min(LIMITS.levelMax, Math.max(1, Number.parseInt(labelOf(line, 'level'), 10) || 1));
    const strengths = labelOf(line, 'strengths').split(/[,;]/).map(item => item.trim().slice(0, 40)).filter(Boolean).slice(0, LIMITS.strengths);
    let member = memberNamed(slice, line.name);
    if (member?.pc) ctx.fail('REFUSED', `${member.name} is the reader's character.`);
    if (!member) {
        if (Object.keys(slice.members).length >= LIMITS.members) ctx.fail('LIMITED', 'The party is full.');
        // (an id from the name, so a Re-read of an edited join line keeps the XP they earned since)
        member = newMember({ name: line.name, id: companionId(line.name, slice.members) ?? ctx.id('ac') });
        slice.members[member.id] = member;
    }
    // (a companion levels from the xp they earn with the party, on top of the level they joined at: a later join line keeps that level and only changes the strengths)
    const level = member.companion ? member.companion.level : asked;
    // (someone who was not a companion before, such as a fallen character of the reader's, starts with no xp held: it counts what they earn from now)
    if (!member.companion && member.xp !== 0) {
        if (typeof ctx.absolute === 'function') ctx.absolute(DOMAIN, `/members/${member.id}/xp`);
        member.xp = 0;
    }
    member.companion = { level, strengths };
    member.fallen = null;
    return { summary: `${member.name} joins the party.`, narrate: true, data: { member: member.id, level, strengths } };
}
