// The scene's tail lines for the prompt: place, who is present, the weather and {{user}}'s look. Pure.

import { cutPoints } from '../../extras.js';
import { WEATHER_TAIL_CHARS } from '../scene/constants.js';
import { youNote } from '../scene/you.js';

/**
 * The scene's tail lines: the place and who is present (nothing when both are empty). With `weather`
 * (the feature is on), the weather ends the Place line, cut to WEATHER_TAIL_CHARS code points. With `you` (the feature is
 * on), one more line says {{user}}'s rank, what they wear and their condition, whichever are set, and while wearing or condition is
 * empty a second line asks the narrator to write the empty ones (`youNote`).
 */
export function sceneTail(state, { weather = false, you = false, rankLabel = '', askLook = true } = {}) {
    const scene = state?.domains?.scene;
    const lines = [];
    const place = scene?.place;
    if (place?.name) {
        const about = [place.kind, place.region].filter(Boolean);
        const sky = weather && typeof scene.weather?.text === 'string' && scene.weather.text ? `; ${cutPoints(scene.weather.text, WEATHER_TAIL_CHARS)}` : '';
        lines.push(`Place: ${place.name}${about.length ? ` (${about.join(', ')})` : ''}${sky}`);
    }
    if (scene?.present?.length) lines.push(`Present: ${scene.present.join(', ')}`);
    if (you) {
        const said = [...(rankLabel ? [['rank', rankLabel]] : []), ['wearing', 'wears'], ['condition', 'condition'], ['position', 'position']]
            .map(([part, word]) => [word, typeof scene?.you?.[part] === 'string' ? scene.you[part] : '']).filter(([, text]) => text);
        // "{{user}}: Guild rank …; wears …; condition …" (the pack's word for the Rank, only with a pack that gives one), only the parts that are set.
        if (said.length) lines.push(`{{user}}: ${said.map(([word, text]) => `${word} ${text}`).join('; ')}`);
        // (Prompt diet: the ask for the look is made once per chat, on the reader's first message (`askLook` false after it), not on every reply until it is set.)
        const note = askLook ? youNote(scene?.you, rankLabel) : '';
        if (note) lines.push(note);
    }
    return lines;
}
