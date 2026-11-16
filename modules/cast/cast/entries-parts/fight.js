// Story Director v2, part **cast**: checking whether any combat session or live Lean RPG fight is active.

import { isRecord } from '../domain.js';
import { leanFight } from './foes.js';
import { ask } from './query.js';

const ENDED = /^(?:ended|over|done|finished|won|lost|fled|resolved|closed|victory|defeat|escaped|surrendered)$/i;

/**
 * Whether a fight is on now: a module that runs fights answers `combat.session` with a session that has not ended, or the Lean RPG has a
 * live foe on its Foes block (`state`, and `leanOn`: its feature is on).
 */
export function fightOn(query, state = null, { leanOn = true } = {}) {
    const session = ask(query, 'combat.session', {}, null);
    if (isRecord(session) && !ENDED.test(typeof session.status === 'string' ? session.status.trim() : '')) return true;
    return leanOn && leanFight(state);
}
