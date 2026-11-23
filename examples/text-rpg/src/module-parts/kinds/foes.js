// `+ foes Name | count: N | threat: <word>` sets up a group of foes before a fight (the same name while some stand: reinforcements; another threat: a new group, "Name 2"); `- foes Name` ends a group (fled or scattered, no XP).
import { DOMAIN, LIMITS } from '../../domain/shape.js';
import { readThreat } from '../../words/threat-read.js';
import { THREAT_WORDS } from '../../words/threat.js';
import { requireActive } from '../active.js';
import { labelOf } from '../line-read.js';
import { groupId, latestFight, recordOfFoes, standing } from '../foes-record.js';
import { touch } from '../foes-stale.js';
import { trimFoes } from '../foes-fights.js';
import { threatShort } from '../matchup.js';

const PER_REPLY = 6;
const MOST = 99;
const clip = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function endGroup(ctx, slice, id, name) {
    const group = slice.foes?.groups?.[id];
    if (!group || group.left <= 0) ctx.fail('NOT_FOUND', `No foes called ${name.slice(0, 40)} are standing.`);
    const was = group.left;
    group.left -= was;
    group.fled = true;
    touch(ctx, slice, group);
    return { summary: `${group.name} are gone from the fight (fled or scattered); no XP.`, narrate: false, data: { group: id, name: group.name, ended: was } };
}

export function applyFoes(ctx, line) {
    requireActive(ctx);
    const slice = ctx.draft(DOMAIN);
    const name = clip(line.name, LIMITS.name);
    const id = groupId(name);
    if (!id) ctx.fail('INVALID', 'Foes need a name.');
    if (line.op === '-') return endGroup(ctx, slice, id, name);
    const sid = ctx.reply?.sid;
    const count = /^\d{1,2}$/.test(labelOf(line, 'count')) ? Number(labelOf(line, 'count')) : 0;
    if (count < 1) ctx.fail('INVALID', 'The count is a whole number from 1 to 99.');
    const threat = readThreat(labelOf(line, 'threat'));
    if (threat < 0) ctx.fail('INVALID', `The threat is one of: ${THREAT_WORDS.join(', ')}.`);
    if (!sid) ctx.fail('LIMITED', 'Foes are set up in a reply.');
    if (!ctx.claim(`foes:${sid}:${id}`)) ctx.fail('LIMITED', `${name.slice(0, 40)} are already set in this reply.`);
    if (!Array.from({ length: PER_REPLY }, (_, at) => at).some(at => ctx.claim(`foes:${sid}:n${at}`))) ctx.fail('LIMITED', `A reply sets up at most ${PER_REPLY} groups of foes.`);

    const record = recordOfFoes(slice);
    const now = Number.isInteger(slice.dice?.[sid]?.clock) ? slice.dice[sid].clock : null;
    // The same name and threat while some stand: reinforcements; the same name of another threat is a new group ("Wolves 2").
    let free = null;
    let named = false;
    for (let n = 1; n <= 9; n++) {
        const gid = n === 1 ? id : groupId(`${name} ${n}`);
        const old = record.groups[gid];
        if (old && old.left > 0) {
            named = true;
            if (old.threat !== threat) continue;
            old.count = Math.min(MOST, old.count + count);
            old.left = Math.min(MOST, old.left + count);
            touch(ctx, slice, old);
            return { summary: `Reinforcements: ${count} more ${old.name} (${threatShort(threat)}); ${old.left} stand.`, narrate: false, data: { group: gid, name: old.name, count, threat, reinforcements: true, left: old.left } };
        }
        free ??= { gid, n };
        if (!old) break;
    }
    if (!free) ctx.fail('LIMITED', `${name.slice(0, 40)} already stand in too many groups.`);
    // New foes in a reply after one where none of the standing groups was hit: those were left behind, and close.
    const left = named ? [] : standing(slice, now);
    const replies = Object.keys(slice.dice ?? {});
    const before = replies[replies.indexOf(sid) - 1];
    if (left.length && before && left.every(([, g]) => typeof g.sid === 'string' && g.sid !== sid && g.sid !== before)) {
        for (const [, g] of left) { g.left = 0; g.fled = true; }
    }
    const fight = latestFight(slice, now);
    const joins = fight?.open ? fight.id : sid;
    if (!record.fights[joins]) record.fights[joins] = { rolled: {}, taught: [] };
    const shown = free.n === 1 ? name : clip(`${name} ${free.n}`, LIMITS.name);
    record.groups[free.gid] = { name: shown, threat, count, left: count, fight: joins };
    touch(ctx, slice, record.groups[free.gid]);
    trimFoes(record);
    return { summary: `Foes set: ${count} ${shown} (${threatShort(threat)}).`, narrate: false, data: { group: free.gid, name: shown, count, threat, reinforcements: false, left: count } };
}
