// The replay guard of the RPG's own blocks (`rpg.fight`, `rpg.practice`, `rpg.checkStep`): each stands while the sheet numbers it used are what the prefix holds.
// The fight itself is settled by the interaction port (core/interaction), whose guard is the port's own.
import { CHECK_STEP, FIGHT, PRACTICE_STEP } from './names.js';
import { fightGuard } from './fight.js';
import { checkGuard, practiceGuard } from './practice.js';

/** The replay guard (docs/v2/REPLAY.md). Pure: the state before the block and what it recorded, nothing else. */
export function leanRpgGuard({ state, hash }, { guard, source, recorded }) {
    const kind = guard?.predicate?.kind;
    if (kind === FIGHT) return fightGuard({ state, hash }, { guard, source, recorded });
    if (kind === PRACTICE_STEP) return practiceGuard({ state, hash }, { guard, source, recorded });
    if (kind === CHECK_STEP) return checkGuard({ state, hash }, { guard, source, recorded });
    return { ok: false, reason: 'Malformed roll guard.' };
}
