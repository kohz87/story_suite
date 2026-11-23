// `+ xp Party — what was overcome [| foes: N] [| group: Name]`: experience. Each foe that fell pays its kind's XP times its group's threat, up to the foes still standing in the foes record, and a battle pays no more than its cap; with no roll in the reply nothing is paid but the foes are still counted down. With nothing standing and no battle current (none yet, or the last one closed more than 60 story minutes ago; with no clock, before the reply just after its close): 10 XP when a roll succeeded this reply, else none; while the battle still stands or has just closed, nothing (its XP was paid as the foes fell). The cap is the strongest group's, scaled by the XP rate like the XP. An old line's `size:` and `threat:` are ignored. Level and stat points follow from xp (standing.js).
import { memberNamed, players } from '../members.js';
import { labelOf } from '../line-read.js';
import { requireActive } from '../active.js';
import { levelOf } from '../standing.js';
import { LEVEL, scaleXp } from '../../rules/levels.js';
import { readRules, xpCeiling } from '../rules-now.js';
import { groupId, standing } from '../foes-record.js';
import { touch } from '../foes-stale.js';
import { payParts } from '../foes-pay.js';
import { joinable } from '../foes-fights.js';
import { DOMAIN } from '../../domain/shape.js';

const NO_RECORD = 10;

// How many were overcome: a whole number 1..50; a missing or bad count is one.
const foesOf = text => (/^\d{1,2}$/.test(text) && Number(text) >= 1 && Number(text) <= 50 ? Number(text) : 1);

// What fell, as [{ group, count }]: with a foes record the foes still standing (all groups, lowest threat first, or the named group) count down and no more than stand are counted; with none standing, nothing.
function paidFoes(ctx, slice, line, asked) {
    const groups = standing(slice, slice.dice?.[ctx.reply?.sid]?.clock);
    const label = labelOf(line, 'group');
    if (label) {
        const [, group] = groups.find(([id]) => id === groupId(label)) ?? [];
        if (!group) ctx.fail('NOT_FOUND', `No foes called ${label.slice(0, 40)} are standing.`);
        const count = Math.min(asked, group.left);
        group.left -= count;
        group.fell = (group.fell ?? 0) + count;
        if (count > 0) touch(ctx, slice, group);
        return [{ group, count }];
    }
    let left = asked;
    const paid = [];
    for (const [, group] of [...groups].sort((a, b) => a[1].threat - b[1].threat)) {
        const count = Math.min(left, group.left);
        if (count <= 0) continue;
        group.left -= count;
        group.fell = (group.fell ?? 0) + count;
        touch(ctx, slice, group);
        left -= count;
        paid.push({ group, count });
    }
    return paid;
}

export function applyXp(ctx, line) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const sid = ctx.reply?.sid;
    if (!sid || !ctx.claim(`xp:${sid}`)) ctx.fail('LIMITED', 'Only one xp line counts in a reply.');
    const record = slice.dice[sid];
    // The cap and rate are the reply's own, kept in its dice step's receipt: a Re-read or a replay never uses today's settings.
    const { cap, rate } = readRules(record?.rules);
    const hardest = record?.used > 0 ? record.hardest ?? 0 : null;
    const fell = labelOf(line, 'group') || standing(slice, record?.clock).length ? paidFoes(ctx, slice, line, foesOf(labelOf(line, 'foes'))) : null;
    const foes = fell ? fell.reduce((sum, part) => sum + part.count, 0) : 0;
    let battle = null;
    let capped = false;
    let over = false;
    let raw = 0;
    if (hardest !== null && fell) ({ raw, battle, capped } = payParts(slice, fell));
    else if (hardest !== null) {
        // Nothing stands: a battle still current (or just closed) was paid as its foes fell; else a deed away from any fight pays 10 XP for a won roll.
        over = joinable(slice, sid, record?.clock ?? null) !== null;
        raw = record?.won && !over ? NO_RECORD : 0;
    }
    const amount = scaleXp(raw, rate);
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
    // The battle's numbers are shown as granted: the XP rate scales the cap and what was paid, as it scales the XP.
    const fight = battle ? `; ${capped ? 'battle cap reached: ' : 'battle '}${scaleXp(battle.paid, rate)} of ${scaleXp(battle.cap, rate)}` : over ? '; the battle is over; its XP was paid as the foes fell' : '';
    return { summary: hardest === null ? `no roll this reply: no XP${told}.` : `${amount} xp${told}${fight}${levels.length ? `; ${levels.join('; ')}` : ''}.`, narrate: levels.length > 0, data: { amount, foes, levels: levels.length, ...(battle ? { battle: { paid: scaleXp(battle.paid, rate), cap: scaleXp(battle.cap, rate) } } : {}) } };
}
