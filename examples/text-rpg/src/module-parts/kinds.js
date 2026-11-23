// The capture kinds of Text RPG and the one apply that sends a line to its kind's handler.
import { FEATURE } from './constants.js';
import { active } from './active.js';
import { GRAMMAR } from './static-text.js';
import { applyTry } from './kinds/try.js';
import { applyXp } from './kinds/xp.js';
import { applyHealth, applySpend } from './kinds/pools.js';
import { applyCondition, applyInjury, applyFall } from './kinds/status.js';
import { applySkill, applyCompanion } from './kinds/roster.js';

const HEAD = { try: '?', xp: '+', condition: '~', injury: '+', skill: '+', companion: '+', fall: '!', health: '~', spend: '~' };
const AFTER = { try: ['companion', 'skill'], xp: ['try'], health: ['try'], fall: ['try', 'health'] };
const APPLY = { try: applyTry, xp: applyXp, condition: applyCondition, injury: applyInjury, skill: applySkill, companion: applyCompanion, fall: applyFall, health: applyHealth, spend: applySpend };

/** The `capture.kinds` table: each kind's grammar shows only while Text RPG is active (the sdk says), and its feature is `text-rpg.on`. */
export function kindsOf(sdk) {
    return Object.fromEntries(Object.keys(HEAD).map(kind => [kind, {
        grammar: () => (active(sdk) ? GRAMMAR[kind] : ''),
        heads: [`${HEAD[kind]} ${kind}`],
        feature: FEATURE,
        ...(AFTER[kind] ? { after: AFTER[kind] } : {}),
    }]));
}

/** `capture.apply`: runs the handler of the line's kind. */
export function applyLine(ctx, line) {
    const apply = APPLY[line?.kind];
    if (!apply) ctx.fail('INVALID', `Text RPG does not keep "${line?.kind}".`);
    return apply(ctx, line);
}
