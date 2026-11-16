/* NPC State Delta dossier view-model part: the Mood tile data and the plain words read from its numbers. */
import { plain, wholeNumber } from '../dossier-ui-model.js';
import { moodBars, moodWord } from '../npc-mood.js';
import { object } from './shared-object.js';

// Mood: the word (the scanner's own, which the numbers follow; the table word of the numbers when it wrote none), and Feeling / Energy / Control each as a row (value on the stored -3..+3 scale, and what it moved by in the reply on show), always
// (all three mood fields are kept). The meters' mood gives the word, the numbers and the history of moves; a person with none yet shows the scanner's
// word (or the resting word) with the three rows at 0. `reply`: the reply on show (a move recorded at it is "this reply"). `bars` and `max` keep the
// step form (0..6, the middle neutral) the plain-words line reads.
export const MOOD_AXES = Object.freeze([['v', 'Feeling', 'feel'], ['a', 'Energy', 'energy'], ['d', 'Control', 'control']]);
export function moodTile(npc, reply = null) {
    const mood = object(npc.v2Meters).mood;
    const now = wholeNumber(reply);
    if (mood) {
        const log = Array.isArray(mood.log) ? mood.log : [];
        const latest = now !== null && log[0] && wholeNumber(log[0].n) === now ? log[0] : null;
        const rows = MOOD_AXES.map(([key, label, tone]) => ({ key, label, tone, value: Math.round(Number(object(mood.axes)[key]) || 0), change: latest ? Math.round(Number(latest[key]) || 0) : 0 }));
        return { title: 'Mood', text: plain(npc.mood) || mood.word, feeling: mood.feeling, energy: mood.energy, control: mood.control, max: mood.max, cause: mood.cause, rows, log, known: true, quiet: now !== null && !latest, atRest: ['v', 'a', 'd'].every(key => Math.round(Number(object(mood.axes)[key]) || 0) === Math.round(Number(object(mood.rest)[key]) || 0)) };
    }
    const rest = moodBars(null);
    return { title: 'Mood', text: plain(npc.mood) || moodWord(null), feeling: rest.max / 2, energy: rest.energy, control: rest.control, max: rest.max, rows: MOOD_AXES.map(([key, label, tone]) => ({ key, label, tone, value: 0, change: 0 })), log: [], known: false, quiet: false };
}

// The few plain words under the mood word, from the three numbers the rows show (-3..+3, 0 neutral): only a number at the code's band edge
// (2 or more away from 0) speaks: unpleasant / pleasant, slack / keyed-up, cornered / in control. Same numbers as the rows, so they always agree.
export function moodDescriptors(mood) {
    const value = key => Number(mood?.rows?.find(row => row.key === key)?.value) || 0;
    const word = (key, low, high) => (value(key) <= -2 ? low : (value(key) >= 2 ? high : ''));
    return [word('v', 'unpleasant', 'pleasant'), word('a', 'slack', 'keyed-up'), word('d', 'cornered', 'in control')].filter(Boolean);
}
