// Reading NPC Inner Chatter text into speaker lines.
import { normalizeName } from '../core-mechanics.js';
import { trimAtWord } from '../suite-handshake.js';
import { PLACEHOLDER, RULE } from './shared-patterns.js';
import { QUOTES_AT_ENDS, cleanLine, plain } from './shared-text.js';

export const CHATTER_LINE_MAX = 240;
export const CHATTER_LINE_LIMIT = 12;

const NOT_A_NAME = /^(?:notes?|example|tone|edit|ooc|warning|summary|context|rules?|output|format|scene|time|location|thoughts?|npc inner chatter|inner chatter|chatter|others?)$/i;
// A sentence with a colon ("Then she said: run") starts with one of these; a name does not.
const NOT_A_FIRST_WORD = new Set([
    'i', 'he', 'she', 'they', 'we', 'you', 'it', 'his', 'her', 'their', 'our', 'my', 'your',
    'then', 'but', 'and', 'so', 'when', 'if', 'now', 'still', 'just', 'later', 'meanwhile',
    'suddenly', 'finally', 'also', 'yes', 'no', 'well', 'oh', 'this', 'that', 'there', 'here',
    'what', 'why', 'how', 'who', 'only', 'even', 'because', 'once', 'after', 'before',
]);

function stripBullet(line) {
    return String(line)
        .replace(/^\s*(?:[-–—•+>]+\s*|\*\s+(?=\S))/u, '')
        .replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+/u, '');
}

function cleanSpeaker(head) {
    return plain(String(head).replace(/[*_]+/g, '').replace(QUOTES_AT_ENDS, ''));
}

// A leading article starts a name only before a capitalised word ("The Astral-Bound Spirit").
const ARTICLES = new Set(['the', 'a', 'an']);
export const SPEAKER_WORDS_MAX = 10;
const SPEAKER_HEAD_MAX = 80;
const KNOWN_SPEAKER_HEAD_MAX = 160;

function nameLike(name) {
    if (!name || name.length > SPEAKER_HEAD_MAX || !/^\p{L}/u.test(name) || NOT_A_NAME.test(name)) return false;
    if (/["“”]/.test(name)) return false;
    const words = name.split(/\s+/);
    const first = words[0].toLowerCase();
    if (words.length > SPEAKER_WORDS_MAX || NOT_A_FIRST_WORD.has(first)) return false;
    return !ARTICLES.has(first) || /^\p{Lu}/u.test(words[1] || '');
}

/**
 * One speaker head and line from `Name: line` (bold names, quotes and bullets tolerated), or null.
 * A head that is the name or alias of a known NPC (`known`: normalized names) is always a speaker.
 */
function readSpeakerLine(raw, known = new Set()) {
    const rest = stripBullet(raw);
    const colon = rest.search(/[:：]/);
    if (colon <= 0 || colon > KNOWN_SPEAKER_HEAD_MAX) return null;
    const head = rest.slice(0, colon);
    let text = rest.slice(colon + 1);
    // `**Astra:** text`: the bold closes after the colon.
    const open = /^\s*(\*{1,3}|_{1,3})/.exec(head);
    if (open && text.startsWith(open[1])) text = text.slice(open[1].length);
    if (text && !/^\s/.test(text)) return null;
    const speaker = cleanSpeaker(head);
    if (!(speaker && known.has(normalizeName(speaker))) && !nameLike(speaker)) return null;
    const line = cleanLine(text);
    return line ? { speaker, line } : null;
}

/**
 * NPC Inner Chatter as [{ speaker, line }] in the block's order: one `Name: line` per line.
 * `names`: the present cards' and tracked NPCs' names and aliases, always accepted as speakers
 * whatever their length or first word. A line that is not a speaker line continues the line above
 * it; before any line it is kept with no speaker (shown under Others) rather than lost. Rules,
 * placeholders and bare headings ("Inner chatter:") are left out. Never throws.
 */
export function parseChatterLines(text, { names = [] } = {}) {
    try {
        if (typeof text !== 'string') return [];
        const known = new Set((Array.isArray(names) ? names : []).map(name => normalizeName(name)).filter(Boolean));
        const out = [];
        for (const raw of text.split(/\r?\n/)) {
            const trimmed = raw.trim();
            if (!trimmed || RULE.test(trimmed) || PLACEHOLDER.test(trimmed)) continue;
            const entry = readSpeakerLine(trimmed, known);
            if (entry) {
                if (out.length >= CHATTER_LINE_LIMIT) break;
                out.push(entry);
                continue;
            }
            const more = cleanLine(stripBullet(trimmed));
            if (!more) continue;
            if (out.length) out[out.length - 1].line = `${out[out.length - 1].line} ${more}`;
            else if (!/[:：]$/.test(more) && !NOT_A_NAME.test(more)) out.push({ speaker: '', line: more });
        }
        return out.map(entry => ({ speaker: entry.speaker, line: trimAtWord(entry.line, CHATTER_LINE_MAX) }));
    } catch {
        return [];
    }
}
