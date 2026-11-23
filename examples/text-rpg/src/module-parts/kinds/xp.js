// `+ xp Party — what was overcome | size: minor|real|major|great`: experience; level and stat points follow from it (standing.js).
import { XP_SIZES, xpFor } from '../../rules/growth.js';
import { THREAT_WORDS } from '../../words/threat.js';
import { memberNamed, players } from '../members.js';
import { labelOf } from '../line-read.js';
import { requireActive } from '../active.js';
import { levelOf } from '../standing.js';
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
        const before = levelOf(member);
        member.xp += amount;
        if (levelOf(member) > before) levels.push(`${member.name} reaches level ${levelOf(member)}`);
    }
    const told = line.text ? ` for ${line.text}` : '';
    return { summary: `${amount} xp${told}${levels.length ? `; ${levels.join('; ')}` : ''}.`, narrate: levels.length > 0, data: { amount, size, levels: levels.length } };
}
