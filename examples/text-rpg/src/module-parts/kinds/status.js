// The status lines: `~ condition`, `+ injury` and `! fall`.
import { INJURY_DAYS } from '../../rules/healing.js';
import { LIMITS } from '../../domain/shape.js';
import { partsOf, labelOf, statKey } from '../line-read.js';
import { target } from './target.js';

const clip = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const keepNewest = (list, max) => { while (list.length > max) list.shift(); };

export function applyCondition(ctx, line) {
    const { member } = target(ctx, line);
    const name = clip(partsOf(line)[0], 40);
    if (!name) ctx.fail('INVALID', 'A condition needs a name.');
    const until = labelOf(line, 'until').toLowerCase();
    member.conditions = member.conditions.filter(item => item.name.toLowerCase() !== name.toLowerCase());
    if (until === 'cleared') return { summary: `${member.name} is no longer ${name}.`, narrate: false, data: { member: member.id, name, cleared: true } };
    const hours = /^(\d+)\s*h/.exec(until);
    // With no story clock a timed condition cannot end by time: it is held until `cleared`.
    const stamp = hours && Number.isInteger(ctx.time?.()) ? ctx.time() + Number(hours[1]) * 60 : 'treated';
    member.conditions.push({ name, until: stamp });
    keepNewest(member.conditions, LIMITS.conditions);
    return { summary: `${member.name} is ${name}.`, narrate: false, data: { member: member.id, name, until: stamp } };
}

export function applyInjury(ctx, line) {
    const { member } = target(ctx, line);
    const name = clip(partsOf(line)[0], LIMITS.name);
    if (!name) ctx.fail('INVALID', 'An injury needs a name.');
    const hampers = [...new Set(labelOf(line, 'hampers').split(/[\s,]+/).map(statKey).filter(Boolean))];
    const grave = Object.hasOwn(INJURY_DAYS, labelOf(line, 'grave').toLowerCase()) ? labelOf(line, 'grave').toLowerCase() : 'minor';
    // With no story clock an injury has no end time (null) until a day's rest with one.
    const heals = Number.isInteger(ctx.time?.()) ? ctx.time() + INJURY_DAYS[grave] * 1440 : null;
    member.injuries.push({ name, hampers, heals, grave });
    keepNewest(member.injuries, LIMITS.injuries);
    return { summary: `${member.name} has ${name}.`, narrate: false, data: { member: member.id, name, hampers, grave } };
}

export function applyFall(ctx, line) {
    const { member } = target(ctx, line);
    const how = clip(partsOf(line)[0] ?? line.text, LIMITS.about);
    member.fallen = { how };
    return { summary: `${member.name} has fallen${how ? `: ${how}` : ''}.`, narrate: true, data: { member: member.id, how } };
}
