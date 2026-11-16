// Field-level salvage of slipped key quotes in a scanner reply that would not parse.
import { parseScanJson } from '../../core.js';

// (rule NSDFOLLOW-1, 12 Nov) Field-level salvage of slipped key quotes, tried only after parseScanJson's own repairs failed, so a
// reply that parsed before parses exactly as before. Each fix is made where JSON.parse stopped, so the parser's own reading says
// which text is a key: a key whose closing quote slipped behind its value ("moodV:0,"moodA":...) gets it back with that same value,
// a key whose quote slipped onto its string value ("mood:"weary",...) likewise; a slipped key whose value is not a plain number,
// true, false or null is dropped whole (never a guessed value); a bare or half-quoted key (moodV":0) is quoted; a comma right
// before a closing brace is removed. Returns { parsed, repairs: [plain words] }, or null when the reply still does not parse.
const SALVAGE_STEPS_MAX = 40;
const JSON_KEY = '[A-Za-z_$][\\w$-]*';
const SLIPPED_SCALAR = new RegExp(`^(${JSON_KEY})\\s*:\\s*(-?\\d+(?:\\.\\d+)?|true|false|null)\\s*,\\s*$`);
const SLIPPED_OPEN = new RegExp(`^(${JSON_KEY})\\s*:\\s*$`);
const SLIPPED_OTHER = new RegExp(`^(${JSON_KEY})\\s*:[^{}\\[\\]]{0,80},\\s*$`);
const BARE_KEY = new RegExp(`^(${JSON_KEY})"?\\s*:`);
function salvageStep(text, error) {
    const message = String(error?.message || '');
    const at = Number(message.match(/position\s+(\d+)/i)?.[1] ?? -1);
    if (!Number.isInteger(at) || at < 0 || at > text.length) return null;
    const before = index => { let i = index; while (i >= 0 && /\s/.test(text[i])) i -= 1; return i; };
    if (/expected ':' after property name/i.test(message)) {
        const end = before(at - 1);
        if (text[end] !== '"') return null;
        const start = text.lastIndexOf('"', end - 1);
        if (start < 1 || text[start - 1] === '\\' || !['{', ','].includes(text[before(start - 1)])) return null;
        const inner = text.slice(start + 1, end);
        const head = text.slice(0, start);
        const tail = text.slice(end + 1);
        let found = inner.match(SLIPPED_SCALAR);
        if (found) return { text: `${head}"${found[1]}":${found[2]},"${tail}`, note: `${found[1]} (closing quote restored)` };
        found = inner.match(SLIPPED_OPEN);
        if (found && /^[^"\\\n]{0,600}"\s*[,}]/.test(tail)) return { text: `${head}"${found[1]}":"${tail}`, note: `${found[1]} (closing quote restored)` };
        found = inner.match(SLIPPED_OTHER);
        if (found) return { text: `${head}"${tail}`, note: `${found[1]} (unreadable value, dropped)` };
        return null;
    }
    if (/expected double-quoted property name/i.test(message)) {
        if (text[at] === '}') {
            const comma = before(at - 1);
            return text[comma] === ',' ? { text: `${text.slice(0, comma)}${text.slice(comma + 1)}`, note: 'a comma before } (removed)' } : null;
        }
        const found = text.slice(at).match(BARE_KEY);
        if (found) return { text: `${text.slice(0, at)}"${found[1]}"${text.slice(at + found[1].length).replace(/^"/, '')}`, note: `${found[1]} (key quoted)` };
    }
    return null;
}
export function salvageScannerJson(raw) {
    if (raw && typeof raw === 'object') return null;
    let text = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first < 0 || last <= first) return null;
    text = text.slice(first, last + 1);
    const repairs = [];
    for (let step = 0; step <= SALVAGE_STEPS_MAX; step += 1) {
        try {
            JSON.parse(text);
            return repairs.length ? { parsed: parseScanJson(text), repairs } : null;
        } catch (error) {
            const fixed = step < SALVAGE_STEPS_MAX ? salvageStep(text, error) : null;
            if (!fixed) return null;
            text = fixed.text;
            repairs.push(fixed.note);
        }
    }
    return null;
}
