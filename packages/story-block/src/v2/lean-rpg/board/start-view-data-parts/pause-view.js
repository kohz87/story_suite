// The pause screen's data for a typed attack on standing foes, and the Auto-fight label.
import { PAUSE_BOARD_LABEL, PAUSE_SEND_LABEL } from './labels.js';
import { countName, fightFoes, foeFrom, list } from './fight-foes.js';

/** "Auto-fight (up to 3 exchanges)" for a cap of 1..8 (9 = until the end). */
export const autoFightLabel = cap => `Auto-fight (${cap >= 9 ? 'until the end' : `up to ${cap} exchange${cap === 1 ? '' : 's'}`})`;
/**
 * The pause screen's data for a typed attack on standing foes: the board and Auto-fight (up to the cap's exchanges).
 * → { mode: 'known' | 'new', title, note, label, boardLabel, autoLabel, sendLabel?, hint? } or null when no foe stands. With `working`: the pre-check's wait line; with `opening` (a recorded opening result): the foes it found.
 */
export function pauseViewData({ fight = null, state = null, cap = 3, opening = null, working = false } = {}) {
    // The pre-check is reading the reader's message (nothing to choose yet).
    if (working) return { mode: 'working', title: 'Setting up the fight…', hint: 'Reading your message for the foes. If it takes more than 20 seconds, your message is sent as it is.', label: 'Setting up the fight' };
    // Foes the pre-check found are not on the sheet yet: they come from the recorded opening.
    const found = opening ? list(opening.opened).map(foeFrom).filter(Boolean) : [];
    const known = found.length ? found : fightFoes(fight, state);
    if (!known.length) return null;
    if (found.length) {
        return {
            mode: 'new', title: `This is an attack on ${known.map(foe => `${foe.name} (${foe.count})`).join(', ')}`,
            note: 'Your message waits while the fight is played on the board.',
            hint: 'Found by the pre-check from your message. Big groups fight as packs.',
            label: 'Fight paused', boardLabel: PAUSE_BOARD_LABEL, autoLabel: autoFightLabel(cap), sendLabel: PAUSE_SEND_LABEL,
        };
    }
    return {
        mode: 'known', title: `This is an attack on ${known.map(countName).join(', ')}`,
        note: 'Your message waits while the fight is played on the board.',
        label: 'Fight paused', boardLabel: PAUSE_BOARD_LABEL, autoLabel: autoFightLabel(cap),
    };
}
