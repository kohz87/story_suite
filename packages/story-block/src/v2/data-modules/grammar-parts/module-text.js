// Builds a module's complete grammar text and its budget-cut version for the static prompt part.
import { DM_LIMITS as L, dmKindWritesHidden } from '../schema.js';
import { oneLine } from '../../../../../../core/text.js';
import { familyLines } from './family-lines.js';

// A kind that writes a hidden field (`prompt: false`) is the reader's: the narrator is not offered it.
const offeredKinds = definition => Object.keys(definition.kinds).filter(name => !dmKindWritesHidden(definition, definition.kinds[name]));

/**
 * The complete text used to measure the static budget before accepting a definition.
 * `options`: { prompt: false } leaves the module's description out; { only: /re/ } offers only the kinds whose name matches, { without: /re/ } leaves out the kinds whose name matches (the RPG's quiet prompt, lean-rpg/names.js
 * QUIET_GRAMMAR); { seen } is a Map shared by the modules of one prompt (see kindGrammar).
 */
export function fullModuleGrammar(definition, reference, { prompt: withPrompt = true, only = null, without = null, seen = null } = {}) {
    const prompt = withPrompt && definition.prompt ? [...oneLine(definition.prompt)].slice(0, L.prompt).join('') : '';
    const names = offeredKinds(definition).filter(name => (!only || only.test(name)) && !(without && without.test(name)));
    return [prompt, ...familyLines(definition, names, reference, seen)].filter(Boolean).join('\n');
}

/**
 * The lines a module adds to the static part, within its character budget (whole lines only). A list of values written on a line that the budget cuts
 * is not remembered in `seen`: a later module writes the words itself, never "same words as" a line that is not in the prompt.
 */
export function moduleGrammar(definition, reference, options = {}) {
    const lines = [];
    let used = 0;
    const local = options.seen ? new Map(options.seen) : null;
    for (const line of fullModuleGrammar(definition, reference, { ...options, ...(local ? { seen: local } : {}) }).split('\n').filter(Boolean)) {
        const next = used + (lines.length ? 1 : 0) + [...line].length;
        if (next > L.staticCharacters) break;
        lines.push(line);
        used = next;
    }
    if (local) for (const [values, where] of local) if (!options.seen.has(values) && lines.some(line => line.includes(values))) options.seen.set(values, where);
    return lines.join('\n');
}
