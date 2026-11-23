// `+ xp Party — what was overcome | size: minor|real|major|great`: experience, level-ups, stat points.
import { gainsAt } from '../../rules/level-gains.js';
import { XP_SIZES, levelFor, xpFor } from '../../rules/growth.js';
import { THREAT_WORDS } from '../../words/threat.js';
import { memberNamed, players } from '../members.js';
import { labelOf } from '../line-read.js';
import { requireActive } from '../active.js';
import { DOMAIN } from '../../domain/shape.js';

export function applyXp(ctx, line) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const sid = ctx.reply?.sid;
    const size = labelOf(line, 'size').toLowerCase();
    if (!Object.hasOwn(XP_SIZES, size)) ctx.fail('INVALID', 'The size is minor, real, major or great.');
    if (!sid || !ctx.claim(`xp:${sid}`)) ctx.fail('LIMITED', 'Only one xp line counts in a reply.');
    const record = slice.dice[sid];
    const said = THREAT_WORDS.indexOf(labelOf(line, 'threat').toLowerCase());
    const amount = xpFor(size, said >= 0 ? said : record?.threat ?? 2, record?.used > 0 ? record.hardest ?? 0 : null);
    const named = memberNamed(slice, line.name);
    const who = named && !named.companion && !named.fallen ? [named] : players(slice).map(p => slice.members[p.id]);
    const levels = [];
    for (const member of who) {
        member.xp += amount;
        const { level } = levelFor(member.xp);
        if (level > member.level) {
            member.points += gainsAt(member.level, level).points;
            member.level = level;
            levels.push(`${member.name} reaches level ${level}`);
        }
    }
    const told = line.text ? ` for ${line.text}` : '';
    return { summary: `${amount} xp${told}${levels.length ? `; ${levels.join('; ')}` : ''}.`, narrate: levels.length > 0, data: { amount, size, levels: levels.length } };
}
