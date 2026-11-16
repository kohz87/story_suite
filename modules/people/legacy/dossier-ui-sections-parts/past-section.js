/* NPC State Delta dossier sections part: the Past section: the remembered events on a timeline of dots. */
import { escapeHtml } from '../../util/html.js';
import { normalizeName } from '../../core/core-text.js';
import { plain, wholeNumber } from '../dossier-ui-model.js';

// Past: the remembered events as written on a timeline of dots. A memory recorded with a stamp (npc.memoryStamps: the reply and the story date
// of that reply) carries "Icewane 27 · #12" as a small label; one recorded before stamps existed has no label (never a guessed date).
const memoryWhen = (npc, memory) => {
    const stamp = npc.memoryStamps?.[normalizeName(memory)];
    const reply = wholeNumber(stamp?.m);
    const label = [typeof stamp?.d === 'string' ? plain(stamp.d) : '', reply === null ? '' : `#${reply}`].filter(Boolean).join(' · ');
    return label ? `<span class="delta-mem-when">${escapeHtml(label)}</span>` : '';
};
export function pastSectionHtml(npc = {}) {
    const memories = (Array.isArray(npc.memories) ? npc.memories : []).map(plain).filter(Boolean);
    if (!memories.length) return '<p class="delta-muted">Nothing remembered yet.</p>';
    return `<ol class="delta-sheet delta-past delta-timeline">${memories.map(memory => `<li><i class="delta-dot-mem" aria-hidden="true"></i>${memoryWhen(npc, memory)}<span>${escapeHtml(memory)}</span></li>`).join('')}</ol>`;
}
