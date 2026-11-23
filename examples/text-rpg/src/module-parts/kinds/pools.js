// The pool lines: paying a skill's cost, `~ spend Who — skill` and `~ health Who — stage | why: …` (the wound stage).
import { DOMAIN } from '../../domain/shape.js';
import { HEALTH_STAGES } from '../../words/pools.js';
import { skillActive, poolOf } from '../effective.js';
import { skillIndex } from '../members.js';
import { partsOf, labelOf } from '../line-read.js';
import { target } from './target.js';

const POOL_WORD = { mp: 'mana', sp: 'stamina' };

/** Takes a skill's cost `times` over from the member's pool: '' when paid, else why it was not (nothing is taken). */
export function spendCost(member, skill, times = 1) {
    if (!skill?.cost) return '';
    const pool = poolOf(member, skill.cost.pool);
    const price = skill.cost.n * times;
    if (pool.now < price) return `${member.name} has no ${POOL_WORD[skill.cost.pool]} for ${skill.name}.`;
    member.pools[skill.cost.pool].now = pool.now - price; // from the value as it reads (never above the size), not the stored one
    return '';
}

export function applySpend(ctx, line) {
    const { member } = target(ctx, line, { acts: true });
    const at = skillIndex(member, partsOf(line)[0]);
    if (at < 0) ctx.fail('NOT_FOUND', `${member.name} has no skill called ${String(partsOf(line)[0] ?? '').slice(0, 40)}.`);
    const skill = member.skills[at];
    if (!skillActive(member, skill)) ctx.fail('REFUSED', `${skill.name} is not known at this level.`);
    const refused = spendCost(member, skill);
    if (refused) ctx.fail('NOT_ENOUGH', refused);
    return { summary: `${member.name} uses ${skill.name}.`, narrate: false, data: { member: member.id, skill: skill.name } };
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
