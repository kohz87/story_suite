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
    const given = String(line.name ?? '').trim();
    if (!given) ctx.fail('INVALID', 'Rest needs a name or Party.');
    const party = /^party$/i.test(given) && !memberNamed(slice, given);
    const named = party ? null : memberNamed(slice, given);
    if (!party && !named) ctx.fail('NOT_FOUND', `No character called ${given.slice(0, 40)}.`);
    if (named?.fallen) ctx.fail('REFUSED', `${named.name} has fallen.`);
    // A companion keeps no mana or stamina on the sheet: resting one (or a party of none) changes nothing, so it is refused rather than told as done.
    const resting = (named ? [named] : players(slice)).map(member => slice.members[member.id]).filter(member => !member.companion);
    if (!resting.length) ctx.fail('REFUSED', named ? `${named.name} is a companion: no mana or stamina to refill.` : 'No one on the sheet rests.');
    const members = restMembers(ctx, resting, { day: kind === 'day' });
    const who = party ? 'The party' : named.name;
    const healed = kind === 'day' ? ' A day heals a stage.' : '';
    return { summary: `${who} ${SAID[kind]}: mana and stamina full.${healed}`, narrate: false, data: { kind, members } };
}
