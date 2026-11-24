// `~ rest Who — short | night | day`: the story shows rest. Short (an hour or more) and night refill mana and stamina; day (a whole day) also heals a stage, clears Down and ages injuries. Refused while foes stand.
import { DOMAIN } from '../../domain/shape.js';
import { requireActive } from '../active.js';
import { standing } from '../foes-record.js';
import { partsOf } from '../line-read.js';
import { memberNamed, players } from '../members.js';
import { restMembers } from '../resting.js';

const KINDS = ['short', 'night', 'day'];
const SAID = { short: 'rests a while', night: 'rests the night', day: 'rests the day' };

export function applyRest(ctx, line) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const kind = String(partsOf(line)[0] ?? '').trim().toLowerCase();
    if (!KINDS.includes(kind)) ctx.fail('INVALID', 'Rest is short, night or day.');
    if (standing(slice, ctx.time?.() ?? null).length) ctx.fail('REFUSED', 'Foes still stand; no one rests.');
    const party = /^party$/i.test(String(line.name ?? '').trim()) && !memberNamed(slice, line.name);
    const named = party ? null : memberNamed(slice, line.name);
    if (!party && !named) ctx.fail('NOT_FOUND', `No character called ${String(line.name).slice(0, 40)}.`);
    if (named?.fallen) ctx.fail('REFUSED', `${named.name} has fallen.`);
    const members = restMembers(ctx, (named ? [named] : players(slice)).map(member => slice.members[member.id]), { day: kind === 'day' });
    const who = party ? 'The party' : named.name;
    const healed = kind === 'day' ? ' A day heals a stage.' : '';
    return { summary: `${who} ${SAID[kind]}: mana and stamina full.${healed}`, narrate: false, data: { kind, members } };
}
