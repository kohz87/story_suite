// `+ xp Party — what was overcome | size: minor|real|major|great [| foes: N] [| group: Name]`: experience (each foe counts, up to the foes still standing in the foes record; with no roll in the reply nothing is paid but the foes are still counted down); level and stat points follow from it (standing.js).
import { XP_SIZES, xpFor } from '../../rules/growth.js';
import { readThreat } from '../../words/threat-read.js';
import { memberNamed, players } from '../members.js';
import { labelOf } from '../line-read.js';
import { requireActive } from '../active.js';
import { levelOf } from '../standing.js';
import { LEVEL, scaleXp } from '../../rules/levels.js';
import { readRules, xpCeiling } from '../rules-now.js';
import { groupId, standing } from '../foes-record.js';
import { touch } from '../foes-stale.js';
import { DOMAIN } from '../../domain/shape.js';

// How many were overcome: a whole number 1..50; a missing or bad count is one.
const foesOf = text => (/^\d{1,2}$/.test(text) && Number(text) >= 1 && Number(text) <= 50 ? Number(text) : 1);

// What is paid for, as [{ threat, count }]: with a foes record the foes still standing (all groups, lowest threat first, or the named group) count down and no more than stand are paid; with none, one foe at most.
function paidFoes(ctx, slice, line, asked, fallbackThreat) {
    const groups = standing(slice, slice.dice?.[ctx.reply?.sid]?.clock);
    const label = labelOf(line, 'group');
    if (label) {
        const [, group] = groups.find(([id]) => id === groupId(label)) ?? [];
        if (!group) ctx.fail('NOT_FOUND', `No foes called ${label.slice(0, 40)} are standing.`);
        const count = Math.min(asked, group.left);
        group.left -= count;
        if (count > 0) touch(ctx, slice, group);
        return [{ threat: group.threat, count }];
    }
    if (!groups.length) return [{ threat: fallbackThreat, count: 1 }];
    let left = asked;
    const paid = [];
    for (const [, group] of [...groups].sort((a, b) => a[1].threat - b[1].threat)) {
        const count = Math.min(left, group.left);
        if (count <= 0) continue;
        group.left -= count;
        touch(ctx, slice, group);
        left -= count;
        paid.push({ threat: group.threat, count });
    }
    return paid;
}

export function applyXp(ctx, line) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const sid = ctx.reply?.sid;
    const size = labelOf(line, 'size').toLowerCase();
    if (!Object.hasOwn(XP_SIZES, size)) ctx.fail('INVALID', 'The size is minor, real, major or great.');
    if (!sid || !ctx.claim(`xp:${sid}`)) ctx.fail('LIMITED', 'Only one xp line counts in a reply.');
    const record = slice.dice[sid];
    const said = readThreat(labelOf(line, 'threat'));
    // The cap and rate are the reply's own, kept in its dice step's receipt: a Re-read or a replay never uses today's settings.
    const { cap, rate } = readRules(record?.rules);
    const hardest = record?.used > 0 ? record.hardest ?? 0 : null;
    // With no roll in the reply nothing is paid, but the foes that fell are still counted down.
    const paid = paidFoes(ctx, slice, line, foesOf(labelOf(line, 'foes')), said >= 0 ? said : record?.threat ?? 2);
    const foes = paid.reduce((sum, part) => sum + part.count, 0);
    const amount = hardest === null ? 0 : scaleXp(paid.reduce((sum, part) => sum + xpFor(size, part.threat, hardest, part.count), 0), rate);
    const named = memberNamed(slice, line.name);
    const who = named && !named.companion && !named.fallen ? [named] : players(slice).map(p => slice.members[p.id]);
    const levels = [];
    for (const member of who) {
        const before = levelOf(member);
        member.xp = Math.min(LEVEL.xpMax, member.xp); // (an xp stored past the limit counts as the limit)
        member.xp += Math.max(0, Math.min(amount, xpCeiling(cap) - member.xp));
        if (levelOf(member) > before) levels.push(`${member.name} reaches level ${levelOf(member)}`);
    }
    const told = `${line.text ? ` for ${line.text}` : ''}${foes > 1 ? ` (${foes} foes)` : ''}`;
    return { summary: hardest === null ? `no roll this reply: no XP${told}.` : `${amount} xp${told}${levels.length ? `; ${levels.join('; ')}` : ''}.`, narrate: levels.length > 0, data: { amount, size, foes, levels: levels.length } };
}
