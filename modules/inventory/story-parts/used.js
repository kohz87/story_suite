// Reads whether a `- item` line says the thing was used, and hands a used consumable to the module that answers `item.use`.

import { labelOf, isPlainObject, clone } from '../../common.js';
import { itemText } from '../validate.js';
import { marked } from './shared-marked.js';

// A consumable the story says was used (MODULES §F96): `- item Potion | used: yes`, or a used-word in
// the line or the reply, and no word that says it went another way.
export const USED_WORDS = /\b(?:used|uses|drank|drinks|drunk|ate|eats|eaten|applied|applies|quaffed|swallowed|consumed)\b/i;

export const GONE_WORDS = /\b(?:lost|loses|sold|sells|gave|given|gives|dropped|stolen|traded|handed|broke|broken|spilled|spilt)\b/i;

/** Whether a `- item` line says the thing was used (not lost, sold, given…): see USED_WORDS. */
export function usedByLine(line, replyText = '') {
    const labels = Object.entries(line?.labels ?? {}).map(([name, value]) => `${name} ${value}`).join(' ');
    const own = `${line?.text ?? ''} ${labels}`;
    if (GONE_WORDS.test(own)) return false;
    if (/^(?:yes|true|1)$/i.test(String(line?.labels?.used ?? '').trim())) return true;
    return USED_WORDS.test(own) || USED_WORDS.test(String(replyText ?? ''));
}

// A used consumable goes to the module that answers `item.use` (its effect is that module's rules):
// `item.use { name, on, qty, story: true }`; with none, to the RPG's own `rpg.useItem` (the pool a consumable restores, lean-rpg/board/overrides.js), which also
// gets the item's def. Null when nothing answers (the line then takes the thing away, as before; the RPG off is that case); a refusal there refuses the line, so the thing stays.
export function useInStory(ctx, line, def, qty) {
    const on = labelOf(line, 'on', 'who', 'by');
    // (the RPG's own recovery is asked only of a reply captured under the `consumableRecovery` mark: an older reply keeps the plain take-away on Re-read)
    const asks = [['item.use', { name: def.name, ...(on ? { on } : {}), qty, story: true }], ...(marked(ctx, 'consumableRecovery') ? [['rpg.useItem', { name: def.name, def: def.id, ...(on ? { on } : {}), qty, story: true }]] : [])];
    let out = null;
    for (const [type, payload] of asks) {
        try {
            out = ctx.call(type, payload);
            break;
        } catch (error) {
            if (['UNKNOWN_COMMAND', 'FEATURE_OFF'].includes(error?.code) && String(error.message).includes(`"${type}"`)) continue;
            throw error;
        }
    }
    if (out === null) return null;
    const data = isPlainObject(out?.data) ? out.data : {};
    return {
        summary: typeof out?.summary === 'string' && out.summary ? out.summary : `${itemText(def.name, qty)} used.`,
        data: { ...clone(data), def: def.id, qty, used: true },
        narrate: typeof out?.narrate === 'boolean' ? out.narrate : false,
    };
}
