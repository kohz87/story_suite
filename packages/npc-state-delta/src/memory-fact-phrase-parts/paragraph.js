// The conditional memory paragraph that lists each handle's allowed sentences within a byte bound.
import { productions } from '../memory-fact-text.js';
import { PARAGRAPH_BYTES } from './limits.js';

const bytes = text => new TextEncoder().encode(text).length;

// The conditional paragraph (appended to the scanner prompt only when handles exist) and the handles it names, byte-bounded: a handle whose
// forms do not fit is skipped whole, never truncated.
export function memoryParagraph(handles, npcs) {
    const head = 'MEMORY FACTS: for each handle below, copy exactly one of its allowed sentences into the optional top-level "mem" object, e.g. "mem":{"h1":"sentence"}. Omit any you do not want to change. Use only the listed sentences.';
    let text = head;
    const used = [];
    for (const handle of handles) {
        const entry = (Array.isArray(npcs) ? npcs : []).find(npc => npc.id === handle.npcId)?.memoryFacts?.entries?.[handle.key];
        if (!entry) continue;
        const line = `\n${handle.h}: ${productions(entry.k, entry.p).map(form => JSON.stringify(form)).join(' | ')}`;
        if (bytes(text + line) > PARAGRAPH_BYTES) continue;
        text += line;
        used.push(handle);
    }
    return used.length ? { text: `\n\n${text}`, handles: used } : { text: '', handles: [] };
}
