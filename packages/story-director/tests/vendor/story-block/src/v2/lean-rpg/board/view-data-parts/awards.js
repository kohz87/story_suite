// Works out the awards the unsent segment would pay and words them as one line.

import { PRACTICE, PRACTICE_SETTING, practiceOf } from '../../names.js';
import { fold, readSheet } from '../../read.js';
import { fightOf, memberLevel, memberXp, outnumberedMultiplier } from '../../fight.js';
import { scaleXp, xpRateFrom } from '../../levels.js';
import { usesOf } from '../../practice.js';

/** Awards for the unsent segment; earlier segments have already paid their own practice. */
export function pendingAwards(state, session, result, settings = {}) {
    const sheet = readSheet(state), fight = fightOf(sheet, session.groups ?? []);
    const rate = xpRateFrom(settings), perUse = practiceOf(session.setup?.opening?.payload?.practice) ?? practiceOf(settings[PRACTICE_SETTING]) ?? PRACTICE.perUse;
    const xp = result.stop === 'won' && fight.won ? sheet.characters.filter(actor => actor.alive !== false && Number.isSafeInteger(actor.xp))
        .map(actor => ({ who: actor.who, amount: scaleXp(memberXp(fight.groups, memberLevel(actor), session.setup?.bars === 2, session.setup?.bars === 2, outnumberedMultiplier(fight.groups, sheet.characters.length)), rate) })) : [];
    const practice = usesOf(result).filter(use => {
        const actor = sheet.characters.find(entry => entry.key === fold(use.who));
        return actor?.skills.some(skill => fold(skill.name) === fold(use.skill));
    }).map(use => ({ who: use.who, skill: use.skill, amount: Math.min(PRACTICE.max, use.n * perUse) }));
    return { xp, practice };
}

/** Compact phone wording; keep the owner on practice when it could otherwise be ambiguous. */
export function pendingAwardsLine({ xp = [], practice = [] } = {}) {
    const earned = xp.filter(item => item.amount > 0);
    const owners = new Set(earned.map(item => item.who));
    const oneOwner = owners.size === 1 && practice.every(item => owners.has(item.who));
    const parts = [
        ...earned.map(item => `${item.who} +${item.amount} XP`),
        ...practice.map(item => `${oneOwner ? '' : `${item.who}: `}${item.skill} +${item.amount}`),
    ];
    return `Pending: ${parts.join(' · ') || 'none'}`;
}
