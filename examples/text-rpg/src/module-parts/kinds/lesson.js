// `+ lesson Who — Skill | what was learned`: a fight's lesson, 5 × the fight's threat multiplier in practice, once for each skill a member rolled in that fight, after its foes are all down or gone.
import { factorOf } from '../../rules/threat-factor.js';
import { PRACTICE_MAX, rankOf } from '../../words/ranks.js';
import { latestFight } from '../foes-record.js';
import { skillIndex } from '../members.js';
import { practiceKey, practiceOf } from '../practice.js';
import { partsOf } from '../line-read.js';
import { target } from './target.js';

const BASE = 5;

export function applyLesson(ctx, line) {
    const { slice, member } = target(ctx, line);
    const [named] = partsOf(line);
    const at = skillIndex(member, named);
    if (member.companion || at < 0) ctx.fail('NOT_FOUND', `${member.name} has no skill called ${String(named ?? '').slice(0, 40)}.`);
    const skill = member.skills[at];
    const fight = latestFight(slice, slice.dice?.[ctx.reply?.sid]?.clock);
    if (!fight) ctx.fail('REFUSED', 'There was no fight set up with + foes to learn from.');
    if (fight.open) ctx.fail('REFUSED', 'The fight is not over: some of its foes still stand.');
    const key = practiceKey(skill.name);
    const record = slice.foes.fights[fight.id];
    if (!(record.rolled[member.id] ?? []).includes(key)) ctx.fail('REFUSED', `${member.name} did not roll ${skill.name} in that fight.`);
    const mark = `${member.id}:${key}`;
    if (record.taught.includes(mark)) ctx.fail('LIMITED', `${skill.name} has already taught ${member.name} what that fight had.`);
    // The strongest group that fell (not one that fled or was left standing).
    const fell = fight.groups.filter(([, group]) => group.left <= 0 && !group.fled);
    if (!fell.length) ctx.fail('REFUSED', 'No foes of that fight fell; fleeing foes teach nothing.');
    const threat = Math.max(...fell.map(([, group]) => group.threat));
    const points = Math.round(BASE * factorOf(threat));
    if (points <= 0) ctx.fail('REFUSED', 'Foes that far beneath them teach nothing.');
    record.taught.push(mark);
    const before = practiceOf(member, skill);
    member.practice[key] = Math.min(PRACTICE_MAX, before + points);
    const gained = member.practice[key] - before;
    const after = rankOf(member.practice[key]);
    const rankUp = after.index > rankOf(before).index ? after.name : null;
    return {
        summary: `${member.name} learned from the fight: ${skill.name} +${gained}${rankUp ? ` (reaches ${rankUp})` : ''}.`, narrate: false,
        data: { member: member.id, skill: skill.name, practice: gained, rankUp },
    };
}
