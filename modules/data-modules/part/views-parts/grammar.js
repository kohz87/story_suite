// The static prompt lines for the pinned modules.
import { activeDefinition } from '../../adapters.js';
import { moduleGrammar, referenceOf } from '../../grammar.js';
import { oneLine } from '../../../../core/text.js';
import { boardGrammar, boardXpGuide } from '../../board-static.js';
import { isMarkedCharacter, restLine } from '../../recovery.js';

/**
 * The static lines for the pinned modules (empty without a pin); they change only when a pin does. `quiet` is an optional table by role ({ skip, keep } or the kinds to offer); the fight board's own
 * pieces come from board-static.js. A long list of values (the health words) is told once.
 */
export function grammarFor(state, quiet = null, { rolled = false, board = false } = {}) {
    // `rolled` (the RPG on, Rolls automatic): skill practice comes only from rolled uses, so the narrator is not offered `practice-N` and the texts
    // that told it to practise a skill say nothing of it (the Combat rules' XP guide line, the Skills block's description).
    const noPractice = text => String(text ?? '').replace(/\s*Practice a skill 5 to 20 per use\./u, '').replace(/\s+and adds practice/u, '');
    const active = Object.keys(state?.domains?.dataModules?.active ?? {});
    const marked = active.some(id => isMarkedCharacter(activeDefinition(state, id)));
    const seen = new Map();
    const lines = active.map(id => {
        let definition = activeDefinition(state, id);
        if (marked && definition?.role === 'rules' && typeof definition.prompt === 'string') definition = { ...definition, prompt: definition.prompt.replace(/\s*XP guide:.*$/gmu, '').trim() };
        // (The board's pieces come from a static file, so a preview before the lazy RPG library has loaded words them the same.)
        const only = (board && boardGrammar(definition?.role)) || (quiet && definition?.role ? quiet[definition.role] : null);
        if (definition && only?.skip) {
            // (A skipped block may keep one line of its text: the XP guide stays on a quiet reply, whatever words the pinned block holds it in.)
            const kept = only.keep ? new RegExp(only.keep.source, 'u').exec(String(definition.prompt ?? ''))?.[0] : '';
            const value = rolled ? noPractice(kept) : kept;
            return kept ? oneLine(board ? boardXpGuide(value) : value) : '';
        }
        const shown = definition && rolled && (definition.role === 'rules' || definition.role === 'skills') ? { ...definition, prompt: noPractice(definition.prompt) } : definition;
        const own = shown ? moduleGrammar(shown, referenceOf(active, id), { seen, ...(only ?? {}), ...(rolled && definition.role === 'skills' ? { without: /^practice-\d+$/u } : {}) }) : '';
        // A marked Character also gets one separate line on what each recovery kind restores: its own room (outside the prompt and grammar caps), so nothing old is dropped.
        const recovery = own && isMarkedCharacter(definition) ? restLine(definition) : '';
        return recovery ? `${own}\n${recovery}` : own;
    }).filter(Boolean);
    return lines.length ? `Data modules in this story (write these lines exactly; a refused line changes nothing):\n${lines.join('\n')}` : '';
}
