// Reading lever lines (label, level, text) and turning evidence texts into up and down cues per drive.
import { DRIVES, OPPOSITES } from './shared-table.js';
import { tokensOf, cueHits } from './cues.js';

const LEVEL_UP = /^(?:very |quite |fairly )?(?:high|strong|great)$/;
const LEVEL_DOWN = /^(?:very |quite |fairly )?(?:low|none|weak|nil|minimal|absent)$/;
// Lever labels that name a drive: the drive's own name, and the honesty family the scanner writes (core-behavior.js lists the same
// words). `flip` labels (deception, secrecy) mean the opposite: a high level lowers Honesty and a low level counts for nothing.
const LABEL_DRIVE = Object.freeze({ candor: 'hone', candour: 'hone', truthfulness: 'hone', sincerity: 'hone', integrity: 'hone' });
const LABEL_FLIP = Object.freeze({ deception: 'hone', deceit: 'hone', secrecy: 'hone' });

// One lever line, "Label[/Alt] [(note)]: level - text" (also "level, text", "level. text" or "level" alone), read the way core-behavior.js
// reads a lever: the label is everything before the first colon (at most 40 characters, markdown * and _ ignored). A label that names a
// drive (or the honesty family) makes the line a drive lever whatever follows the colon: the level is the 1-3 words after it, or '' when
// none parses, and the text is never read as prose. Any other label is a lever only with up to 3 words and a parsed level.
// Returns { label, parts, level, body } or null when the line is not lever-shaped (then it is free prose). `parts` are the label split
// on / & , + ( ) and "and", lower-cased.
const labelKey = part => DRIVES.find(drive => drive.label.toLowerCase() === part || drive.kind === part)?.key ?? LABEL_DRIVE[part] ?? LABEL_FLIP[part];
export function parseLever(text) {
    const raw = String(text ?? '');
    const colon = raw.indexOf(':');
    if (colon < 1 || colon > 40) return null;
    const label = raw.slice(0, colon).replace(/[*_]/g, '').trim();
    if (!label || /[.!?]/.test(label)) return null;
    const parts = label.split(/[/&,+()]|\band\b/i).map(part => part.trim().toLowerCase()).filter(Boolean);
    const isDrive = parts.some(part => labelKey(part));
    if (!isDrive && label.split(/\s+/).length > 3) return null;
    const rest = /^[\s*_]*([A-Za-z]+(?: [A-Za-z]+){0,2}?)\s*(?:[-\u2013\u2014,;:(.]|$)(.*)$/s.exec(raw.slice(colon + 1));
    if (!rest) return isDrive ? { label, parts, level: '', body: raw.slice(colon + 1).trim() } : null;
    return { label, parts, level: rest[1].toLowerCase(), body: rest[2].trim() };
}
// The direction a level word gives: 'u' (high), 'd' (low), '' (medium, or any other word).
const levelDir = level => (LEVEL_UP.test(level) ? 'u' : LEVEL_DOWN.test(level) ? 'd' : '');

// Each line read on its own (a negator never reaches across lines): { key: { up: [cue words], down: [cue words] } }. A lever line
// never has its text matched against cue words: its label names the drive(s) and its level gives the direction (high raises, low
// lowers, medium or any other word does nothing); a lever whose label names no drive counts for nothing. Cue words apply only to free
// prose (memories, mannerisms, impact text): a negated cue counts toward the opposite direction, a negated opposite cue counts for
// nothing, so evidence that says a drive is weak never raises it.
export function leverCues(texts, skip) {
    const out = Object.fromEntries(DRIVES.map(drive => [drive.key, { up: [], down: [] }]));
    const add = (list, word) => { if (!list.includes(word)) list.push(word); };
    for (const text of texts) {
        const lever = parseLever(text);
        if (lever) {
            const dir = levelDir(lever.level);
            for (const part of lever.parts) {
                const named = DRIVES.find(drive => drive.label.toLowerCase() === part || drive.kind === part);
                const alias = LABEL_DRIVE[part];
                const flip = LABEL_FLIP[part];
                const key = named?.key ?? alias ?? flip;
                if (!key || !dir) continue;
                const kind = DRIVES.find(drive => drive.key === key).kind;
                const direction = flip && !named ? (dir === 'u' ? 'd' : '') : dir;
                if (direction) add(out[key][direction === 'u' ? 'up' : 'down'], kind);
            }
            continue;
        }
        const tokens = tokensOf(text);
        for (const drive of DRIVES) {
            const same = cueHits(drive.words, tokens, skip);
            const opposite = cueHits(OPPOSITES[drive.key], tokens, skip);
            same.pos.forEach(word => add(out[drive.key].up, word));
            same.neg.forEach(word => add(out[drive.key].down, word));
            opposite.pos.forEach(word => add(out[drive.key].down, word));
        }
    }
    return out;
}
