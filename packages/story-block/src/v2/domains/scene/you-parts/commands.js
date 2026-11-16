// The commands that write {{user}}'s look: `scene.you` (the reader or a module) and the `~ you` capture kind. Pure.

import { YOU_PARTS } from '../constants.js';
import { changeYou } from './change.js';
import { youParts, youText } from './text.js';

/**
 * `scene.you({ rank?, wearing?, condition?, position? })`: {{user}}'s standing, what they wear, how they are and their position, from the reader (the pencils on Home) or a
 * module, never the story (it writes `~ you`). A part that is given replaces that part, '' clears it; a part left out stays.
 */
export function setYou(ctx, payload = {}) {
    if (ctx.cause === 'story') ctx.fail('REFUSED', 'The story writes your look with a ~ you line.');
    const parts = {};
    for (const part of YOU_PARTS) {
        const value = payload?.[part];
        if (value === undefined || value === null) continue;
        if (typeof value !== 'string') ctx.fail('INVALID', `Your ${part} must be text.`);
        parts[part] = youText(value);
    }
    if (!Object.keys(parts).length) ctx.fail('INVALID', 'Say what you wear or how you are.');
    return changeYou(ctx, parts);
}

/**
 * `~ you rank: F-rank, Adventurer Guild | wearing: oilskin coat, boots | condition: tired and cold` (or `+ you`): {{user}}'s
 * standing, what they wear and how they are,
 * descriptive only (no mechanics read it). Either part alone is fine and the other stays; an empty one clears its part. Kept as
 * `scene.you = { rank, wearing, condition }`, each part written on its own, and `you` is one of the scene's `scratch` fields, so a
 * later reply's write replays after the reply that first wrote one is deleted (SPEC §2.2).
 */
export function captureYou(ctx, line) {
    if (line?.op !== '~' && line?.op !== '+') {
        ctx.fail('INVALID', `"${line?.op} you" is not a change the scene understands; use ~ you rank: … | wearing: … | condition: ….`);
    }
    const fallback = `~ you ${[`${line?.name ?? ''}${line?.text ? ` - ${line.text}` : ''}`, ...Object.entries(line?.labels ?? {}).map(([label, value]) => `${label}: ${value}`)].join(' | ')}`;
    const parts = youParts(line?.raw ?? fallback);
    if (!Object.keys(parts).length) ctx.fail('INVALID', 'The you line names no part of your look (write "~ you rank: F-rank | wearing: a grey coat | condition: tired").');
    return changeYou(ctx, parts, { dropRank: true });
}
