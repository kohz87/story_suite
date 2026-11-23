// The pool lines: paying a skill's cost, `~ spend Who — skill`, `~ train Who — skill` and `~ health Who — stage | why: …` (the wound stage).
import { DOMAIN } from '../../domain/shape.js';
import { SPEND_PRACTICE, practiceFor } from '../../rules/practice.js';
import { HEALTH_STAGES } from '../../words/pools.js';
import { skillActive } from '../effective.js';
import { gearOf } from '../gear.js';
import { poolWith } from '../gear-sizes.js';
import { skillIndex } from '../members.js';
import { partsOf, labelOf } from '../line-read.js';
import { diceBefore } from '../dice-source.js';
import { addPractice, threatHeard } from '../practice-gain.js';
import { costPaidAlready } from '../paid-marks.js';
import { target } from './target.js';

const POOL_WORD = { mp: 'mana', sp: 'stamina' };

/** Takes a skill's cost `times` over from the member's pool: '' when paid, else why it was not (nothing is taken). */
export function spendCost(member, skill, cap = {}, times = 1) {
    if (!skill?.cost) return '';
    const pool = poolWith(member, skill.cost.pool, cap);
    const price = skill.cost.n * times;
    if (pool.now < price) return `${member.name} has no ${POOL_WORD[skill.cost.pool]} for ${skill.name}.`;
    member.pools[skill.cost.pool].now = pool.now - price; // from the value as it reads (never above the size), not the stored one
    return '';
}

export function applySpend(ctx, line) {
    const { slice, member } = target(ctx, line, { acts: true });
    const at = skillIndex(member, partsOf(line)[0]);
    if (at < 0) ctx.fail('NOT_FOUND', `${member.name} has no skill called ${String(partsOf(line)[0] ?? '').slice(0, 40)}.`);
    const skill = member.skills[at];
    if (!skillActive(member, skill)) ctx.fail('REFUSED', `${skill.name} is not known at this level.`);
    // A try of the same skill in this reply pays its own cost (either order), so the spend then pays nothing.
    const sid = ctx.reply?.sid;
    const free = costPaidAlready(slice, sid, skill, 'spend');
    const refused = free ? '' : spendCost(member, skill, gearOf(ctx.query, member).cap);
    if (refused) ctx.fail('NOT_ENOUGH', refused);
    // A skill used without a roll teaches a little: once a reply, and not when the reply rolled it (kinds/try.js), scaled by the threat so far.
    const { gained, rankUp } = addPractice(slice, sid, member, skill, 'spend', practiceFor(SPEND_PRACTICE, threatHeard(slice, sid, slice.dice[sid])));
    return { summary: `${member.name} uses ${skill.name}${free ? ' (paid by the roll)' : ''}.`, narrate: false, data: { member: member.id, skill: skill.name, practice: gained, rankUp, ...(free ? { paidByRoll: true } : {}) } };
}

const sessionsOf = text => (/^\d{1,2}$/.test(text) && Number(text) >= 1 && Number(text) <= 60 ? Number(text) : 1);

/** The whole days the story clock moved since the reply's dice step was made (at least 1; 1 when either clock is unknown). */
function daysOf(ctx) {
    const start = diceBefore(ctx.reply?.index, ctx.receipts(), ctx.standingReceipts ?? [])?.clock;
    const now = ctx.time?.();
    return Number.isInteger(start) && Number.isInteger(now) ? Math.max(1, Math.floor((now - start) / 1440)) : 1;
}

/** `~ train Who — Skill | sessions: N`: training teaches +1 a session (no threat scale), at most one a story day since the reply began; once a skill a reply. */
export function applyTrain(ctx, line) {
    const { slice, member } = target(ctx, line, { acts: true });
    const at = skillIndex(member, partsOf(line)[0]);
    if (at < 0) ctx.fail('NOT_FOUND', `${member.name} has no skill called ${String(partsOf(line)[0] ?? '').slice(0, 40)}.`);
    const skill = member.skills[at];
    if (!skillActive(member, skill)) ctx.fail('REFUSED', `${skill.name} is not known at this level.`);
    const sid = ctx.reply?.sid;
    const asked = sessionsOf(labelOf(line, 'sessions'));
    const days = asked > 1 ? daysOf(ctx) : 1;
    const sessions = Math.min(asked, days);
    const { gained, rankUp } = addPractice(slice, sid, member, skill, 'train', sessions);
    return { summary: `${member.name} trains ${skill.name}.`, narrate: false, data: { member: member.id, skill: skill.name, practice: gained, rankUp, sessions, asked, days } };
}

export function applyHealth(ctx, line) {
    const { member } = target(ctx, line);
    const word = (partsOf(line)[0] ?? '').toLowerCase();
    const goal = HEALTH_STAGES.findIndex(stage => stage.toLowerCase() === word);
    if (goal < 0) ctx.fail('INVALID', `Health is one of ${HEALTH_STAGES.join(', ')}.`);
    // A stage is a set: it lands where it says whatever the replies before it did.
    ctx.absolute(DOMAIN, `/members/${member.id}/wounds`);
    ctx.absolute(DOMAIN, `/members/${member.id}/down`);
    member.wounds = goal;
    member.down = goal === 5; // only `~ health` makes Down; any other stage clears it
    const why = labelOf(line, 'why');
    return { summary: `${member.name} is ${HEALTH_STAGES[goal]}${why ? `: ${why}` : ''}.`, narrate: false, data: { member: member.id, stage: goal, why } };
}
