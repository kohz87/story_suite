// `+ xp Party — what was overcome | size: minor|real|major|great [| foes: N]`: experience (each foe counts); level and stat points follow from it (standing.js).
import { XP_SIZES, xpFor } from '../../rules/growth.js';
import { THREAT_WORDS } from '../../words/threat.js';
import { memberNamed, players } from '../members.js';
import { labelOf } from '../line-read.js';
import { requireActive } from '../active.js';
import { levelOf } from '../standing.js';
import { LEVEL, scaleXp } from '../../rules/levels.js';
import { readRules, xpCeiling } from '../rules-now.js';
import { DOMAIN } from '../../domain/shape.js';

// How many were overcome: a whole number 1..50; a missing or bad count is one.
const foesOf = text => (/^\d{1,2}$/.test(text) && Number(text) >= 1 && Number(text) <= 50 ? Number(text) : 1);

export function applyXp(ctx, line) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const sid = ctx.reply?.sid;
    const size = labelOf(line, 'size').toLowerCase();
    if (!Object.hasOwn(XP_SIZES, size)) ctx.fail('INVALID', 'The size is minor, real, major or great.');
    if (!sid || !ctx.claim(`xp:${sid}`)) ctx.fail('LIMITED', 'Only one xp line counts in a reply.');
    const record = slice.dice[sid];
    const said = THREAT_WORDS.indexOf(labelOf(line, 'threat').toLowerCase());
    // The cap and rate are the reply's own, kept in its dice step's receipt: a Re-read or a replay never uses today's settings.
    const { cap, rate } = readRules(record?.rules);
    const foes = foesOf(labelOf(line, 'foes'));
    const amount = scaleXp(xpFor(size, said >= 0 ? said : record?.threat ?? 2, record?.used > 0 ? record.hardest ?? 0 : null, foes), rate);
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
    return { summary: `${amount} xp${told}${levels.length ? `; ${levels.join('; ')}` : ''}.`, narrate: levels.length > 0, data: { amount, size, foes, levels: levels.length } };
}
