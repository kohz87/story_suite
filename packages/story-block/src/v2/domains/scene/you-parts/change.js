// Putting {{user}}'s look parts into the scene draft, the Rank checked against the pack and the Guild record. Pure.

import { isPlainObject } from '../../common.js';
import { YOU_PARTS } from '../constants.js';
import { guildOf, rankAgrees, rankLabelIn } from './rank.js';

// Puts the given parts into the scene: a part that differs replaces that part only (one op each, so a replay after an earlier
// reply was deleted keeps the other part as the replies still there left it). Nothing differs: nothing is written.
export function changeYou(ctx, parts, { dropRank = false } = {}) {
    // Rank comes from a pack: a story with none has no Rank, so a call that names it is refused (nothing saved). A story's line keeps
    // its other parts (`dropRank`): only the rank is left out, with one plain Problem.
    let problem = '';
    if (parts.rank !== undefined && !rankLabelIn(ctx.query)) {
        problem = 'This story has no rank, so "rank" was not used (a pack can give your character one).';
        if (!dropRank || Object.keys(parts).length < 2) ctx.fail('INVALID', problem);
        parts = { ...parts };
        delete parts.rank;
    }
    // With the pack's Guild module in the story, the rank follows it: a story line that claims otherwise is left out with one plain Problem.
    // Only for a reply marked `youRank` (turn/rule-marks.js): a reply captured before it, run again, keeps its rank line as it was.
    if (dropRank && parts.rank && ctx.carrier?.rules?.includes('youRank')) {
        let guild = null;
        try { guild = guildOf(ctx.read('dataModules'), ctx.query); } catch { guild = null; }
        if (!rankAgrees(parts.rank, guild)) {
            problem = `The ${guild.label} record says you ${guild.registered ? `are rank ${guild.letter}` : 'are not registered'}, so "rank" was not used (it follows that record).`;
            if (Object.keys(parts).length < 2) ctx.fail('INVALID', problem);
            parts = { ...parts };
            delete parts.rank;
        }
    }
    const scene = ctx.draft('scene');
    const held = isPlainObject(scene.you) ? scene.you : null;
    const now = part => (typeof held?.[part] === 'string' ? held[part] : '');
    const next = held ? { ...held } : { rank: '', wearing: '', condition: '' };
    const said = [];
    for (const part of YOU_PARTS) {
        if (parts[part] === undefined || parts[part] === now(part)) continue;
        next[part] = parts[part];
        said.push(parts[part] ? `${part} ${parts[part]}` : `${part} cleared`);
    }
    const data = part => parts[part] === undefined ? now(part) : parts[part];
    const place = (out, read) => (read('position') ? { ...out, position: read('position') } : out);   // position only when one is set
    const told = problem ? { problem } : {};
    if (!said.length) return { summary: 'Your look stays.', data: place({ rank: now('rank'), wearing: now('wearing'), condition: now('condition'), same: true }, now), narrate: false, ...told };
    scene.you = next;
    return { summary: `Your look: ${said.join('; ')}.`, data: place({ rank: data('rank'), wearing: data('wearing'), condition: data('condition') }, data), narrate: false, ...told };
}
