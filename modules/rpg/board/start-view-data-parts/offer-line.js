// The inline offer data under the narrator's reply.
import { OFFER_AUTO_LABEL, OFFER_BOARD_LABEL } from './labels.js';
import { countName, fightFoes } from './fight-foes.js';

/**
 * The inline offer under the narrator's reply: `{ visible, text, foes, label, boardLabel, autoLabel }`, or null with no fight.
 * `hidden` is the reader's choice to keep narrating this fight. `state` lets the names come from the current sheet.
 */
export function offerLineData(fight, { state = null, hidden = false } = {}) {
    const foes = fightFoes(fight, state);
    if (!foes.length) return null;
    const names = [...new Set(foes.map(foe => foe.name))];
    const joined = names.join(', ');
    // A fight that ended with foes still up says so (offers.js sets `standing`); the groups show their counts.
    const standing = fight?.standing === true;
    return {
        visible: hidden !== true, foes,
        text: standing ? `Foes are still standing: ${foes.map(countName).join(', ')}` : `A fight started: ${joined}.`,
        label: `Fight offer: ${joined}`,
        boardLabel: OFFER_BOARD_LABEL,
        autoLabel: OFFER_AUTO_LABEL,
    };
}
