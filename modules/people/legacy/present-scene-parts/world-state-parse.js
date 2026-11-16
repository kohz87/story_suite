// Reading a World State block: its NPC sections and who it says is present or off-screen.
import { normalizeName } from '../../core/core-mechanics.js';
import { PLACEHOLDER, RULE } from './shared-patterns.js';
import { cleanLine, plain } from './shared-text.js';

const WS_FIELDS = Object.freeze({
    outfit: 'outfit', clothing: 'outfit', clothes: 'outfit', attire: 'outfit', dress: 'outfit',
    mood: 'mood', emotion: 'mood', expression: 'mood', demeanor: 'mood', demeanour: 'mood',
    condition: 'condition', 'visible condition': 'condition', status: 'condition', state: 'condition',
    injuries: 'condition', health: 'condition',
});
const WS_HEADER = /^\s*(?:[-*•]\s+)?(?:\*\*\s*(.+?)\s*:\s*\*\*|\*\*\s*(.+?)\s*\*\*\s*:)\s*$/u;
const WS_FIELD = /^\s*[-*•]\s+(?:\*{1,2}|_{1,2})?\s*([\p{L}][\p{L} ]{0,30}?)\s*:\s*(?:\*{1,2}|_{1,2})?\s*(.*)$/u;

function fieldValue(value) {
    const text = cleanLine(value);
    return !text || PLACEHOLDER.test(text) ? '' : text;
}

/**
 * The people of a World State block (Megumin Suite's / Story Block's layout): a `**Name:**` line
 * followed by `* *Outfit:* …`, `* *Mood:* …`, `* *Visible Condition:* …` bullets. Returns
 * [{ name, mood, condition, outfit }] in order, first section per name. Never throws.
 */
export function parseWorldStateNpcs(text) {
    try {
        const sections = [];
        let current = null;
        for (const raw of String(text ?? '').split(/\r?\n/)) {
            const line = raw.trim();
            if (!line) continue;
            if (RULE.test(line)) { current = null; continue; }
            const header = WS_HEADER.exec(line);
            if (header) {
                const name = plain(String(header[1] ?? header[2] ?? '').replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+/u, '').replace(/[*_]+/g, ''));
                current = name && !PLACEHOLDER.test(name) ? { name, mood: '', condition: '', outfit: '' } : null;
                if (current) sections.push(current);
                continue;
            }
            const field = current ? WS_FIELD.exec(line) : null;
            const key = field ? WS_FIELDS[plain(field[1]).toLowerCase()] : '';
            if (key && !current[key]) current[key] = fieldValue(field[2]);
        }
        const seen = new Set();
        return sections.filter(section => {
            const key = normalizeName(section.name);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    } catch {
        return [];
    }
}

// (1.2.10) A World State's people sections: "**👥 NPCs Present:**" and "**📡 Off-Screen:**".
const WS_PRESENT_HEADING = /^\s*(?:[-*•]\s+)?\**\s*(?:[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*)?(?:NPCs?|Characters?|People)\s+(?:Present|In\s+(?:the\s+)?Scene)\s*:?\s*\**\s*:?\s*$/iu;
const WS_OFFSCREEN_HEADING = /^\s*(?:[-*•]\s+)?\**\s*(?:[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*)?Off[\s-]?Screen\s*:?\s*\**\s*:?\s*$/iu;
const WS_NONE = /^\s*[*_(\[]*\s*(?:none|nobody|no one|empty|—|-)\s*[)\]*_.]*\s*$/i;
// An Off-Screen line: "* Brecht — Beat Astra senseless…", "* Bond collector — now: …", "* Jor: hiding".
const WS_OFFSCREEN_LINE = /^\s*[-*•]\s+\**\s*([^—–:*]+?)\s*\**\s*(?:—|–|-\s|:)/u;

const cleanName = value => plain(String(value ?? '').replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+/u, '').replace(/[*_]+/g, ''));

/**
 * (1.2.10) Who a World State block puts where: `present`, the `**Name:**` headers under its
 * "NPCs Present" heading; `none`, true when that section says "(None)"; `offscreen`, the names
 * its "Off-Screen" lines start with. A list is null when the block has no such section.
 * Each section runs to the next `---` rule or the next section heading. Never throws.
 */
export function worldStatePeople(text) {
    const out = { present: null, none: false, offscreen: null };
    try {
        let section = '';
        const add = (list, name) => {
            if (name && !PLACEHOLDER.test(name) && !list.some(other => normalizeName(other) === normalizeName(name))) list.push(name);
        };
        for (const raw of String(text ?? '').split(/\r?\n/)) {
            const line = raw.trim();
            if (!line) continue;
            if (WS_PRESENT_HEADING.test(line)) { section = 'present'; out.present ||= []; continue; }
            if (WS_OFFSCREEN_HEADING.test(line)) { section = 'offscreen'; out.offscreen ||= []; continue; }
            if (RULE.test(line)) { section = ''; continue; }
            if (section === 'present') {
                if (WS_NONE.test(line)) { out.none = true; continue; }
                const header = WS_HEADER.exec(line);
                if (header) add(out.present, cleanName(header[1] ?? header[2]));
            } else if (section === 'offscreen') {
                const entry = WS_OFFSCREEN_LINE.exec(line);
                if (entry) add(out.offscreen, cleanName(entry[1]));
            }
        }
        if (out.present && out.present.length) out.none = false;
    } catch {
        return { present: null, none: false, offscreen: null };
    }
    return out;
}
