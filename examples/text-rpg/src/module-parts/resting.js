// The one rule of resting, shared by `textRpg.rest` (a command) and `~ rest` (a story line): mana and stamina refill; a whole day also heals a stage and ages injuries.
import { DOMAIN } from '../domain/shape.js';
import { INJURY_DAYS } from '../rules/healing.js';
import { gearOf } from './gear.js';
import { poolWith } from './gear-sizes.js';
import { woundsOf } from './standing.js';

const listed = words => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`);

/** Why these foes groups (`[[id, group]]`) stop a rest, and the lines that end them: `{ why, end }`, or null when there are none. */
export function restBlock(groups) {
    if (!groups.length) return null;
    const names = groups.map(([, group]) => group.name);
    return { why: `the fight with ${listed(names)} is still on`, end: `If those foes are gone, ${listed(names.map(name => `"- foes ${name}"`))} ${names.length > 1 ? 'end' : 'ends'} the fight.` };
}

/** Rests each member (companions are skipped); `day: true` is a whole day. Returns the ids rested. Pools and Down are sets (`ctx.absolute`). */
export function restMembers(ctx, members, { day = false } = {}) {
    const known = Number.isInteger(ctx.time?.());
    const now = known ? ctx.time() : 0;
    const who = members.filter(member => !member.companion);
    for (const member of who) {
        for (const pool of ['mp', 'sp']) ctx.absolute(DOMAIN, `/members/${member.id}/pools/${pool}/now`);
        const { cap } = gearOf(ctx.query, member);
        member.pools.mp.now = poolWith(member, 'mp', cap).max;
        member.pools.sp.now = poolWith(member, 'sp', cap).max;
        if (!day) continue;
        // A change on the counter (not a value from the clamped read); a day's rest also clears the Down mark.
        if (woundsOf(member) > 0) member.wounds -= 1;
        ctx.absolute(DOMAIN, `/members/${member.id}/down`);
        member.down = false;
        // An injury made with no clock has no end time (null); the first day's rest with a clock starts its count.
        for (const injury of member.injuries) injury.heals = injury.heals === null && !known ? null : Math.max(0, (injury.heals ?? now + INJURY_DAYS[injury.grave] * 1440) - 1440);
        member.injuries = member.injuries.filter(injury => injury.heals === null || injury.heals > now);
    }
    return who.map(member => member.id);
}
