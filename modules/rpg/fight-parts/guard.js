// The replay guard of `rpg.fight`.

import { FIGHT, FOE_SLOTS } from '../names.js';
import { xpRateOf } from '../levels.js';
import { readSheet } from '../read.js';
import { CLAIM, isObject, slotsOf } from './shared-values.js';
import { groupsOf } from './won.js';
import { fightWitness } from './witness.js';

/** The replay guard of `rpg.fight` (leanRpgGuard routes it here): the step stands while the sheet numbers it used are what the prefix holds. */
export function fightGuard({ state, hash }, { guard, source, recorded }) {
    const bad = reason => ({ ok: false, reason });
    try {
        const predicate = guard?.predicate;
        if (guard?.version !== 2 || guard.rulesHash !== null || !isObject(predicate) || predicate.kind !== FIGHT || !isObject(recorded)) return bad('Malformed fight guard.');
        const was = slotsOf(recorded.was);
        if (!was.length || was.length !== recorded.was.length || was.some(slot => slot > FOE_SLOTS * 25)) return bad('The fight\'s groups were damaged.');
        if (recorded.rate !== undefined && xpRateOf(recorded.rate) === null) return bad('The fight\'s XP rate was damaged.');
        const groups = recorded.groups === undefined ? null : groupsOf(recorded.groups, was);
        if (recorded.groups !== undefined && !groups) return bad('The fight\'s groups were damaged.');
        if ((recorded.bars !== undefined && recorded.bars !== 2) || (predicate.bars === 2) !== (recorded.bars === 2)) return bad('The fight\'s mark was damaged.');
        if ((recorded.xp !== undefined && (recorded.xp !== 2 || recorded.bars !== 2)) || (predicate.xp === 2) !== (recorded.xp === 2)) return bad('The fight\'s XP mark was damaged.');
        if ((recorded.outnumbered !== undefined && recorded.outnumbered !== 1) || (predicate.outnumbered !== undefined && predicate.outnumbered !== 1) || (predicate.outnumbered === 1) !== (recorded.outnumbered === 1)) return bad('The fight\'s outnumbered mark was damaged.');
        if ((recorded.gone !== undefined && recorded.gone !== 1) || (predicate.gone === 1) !== (recorded.gone === 1) || (recorded.gone === 1) !== (recorded.claim !== undefined)) return bad('The fight\'s clear mark was damaged.');
        if (recorded.gone === 1 && (!CLAIM.test(recorded.claim) || state.meta?.claims?.[recorded.claim] !== true)) return bad('The fight on the board this XP was for was taken back.');
        const witness = fightWitness(readSheet(state), state.domains?.dataModules, source, { was, groups, ...(recorded.outnumbered === 1 ? { outnumbered: 1 } : {}) });
        if (hash({ source, predicate, witness }) !== guard.inputHash) return bad('The sheet before this step changed; Re-read this reply.');
        return { ok: true };
    } catch { return bad('Damaged fight record.'); }
}
