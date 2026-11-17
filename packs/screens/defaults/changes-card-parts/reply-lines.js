// Cleans the modules' own reply-card lines (their checks and tones) and merges in the RPG's lines.
import { STRINGS, fill } from '../../../../core/strings.js';
import { oneLine } from '../../../../core/text.js';
import { isRecord } from './shared-record.js';

const C = STRINGS.card;

/** The most lines one module adds to a reply's card (MODULES §F125). */
export const REPLY_LINES_MAX = 6;
const ICON = /^fa-[a-z0-9-]{1,40}$/;

/**
 * The modules' own lines for one reply's card (MODULES §F125). `entries`: [{ moduleId, fn }] (the registry's
 * `hookEntries('replyCard')`); `info`: { index, state, before, changes } of that reply. Each hook is called
 * with a copy of `info`; one that throws or answers anything but a list (a promise too) adds nothing.
 * → [{ module, icon, text, summary, flag, note }], each field one line: text ≤ 200, summary ≤ 80, flag and
 * note ≤ 160 characters; a line without text is left out.
 */
export function replyCardLines(entries, info = {}) {
    const out = [];
    for (const { moduleId, fn } of Array.isArray(entries) ? entries : []) {
        if (typeof fn !== 'function') continue;
        let answer;
        try {
            answer = fn({ index: info.index ?? null, state: info.state ?? null, before: info.before ?? null, changes: [...(info.changes ?? [])] });
        } catch {
            continue;
        }
        if (!Array.isArray(answer)) continue;
        for (const item of answer.slice(0, REPLY_LINES_MAX)) {
            const line = typeof item === 'string' ? { text: item } : item;
            if (!isRecord(line)) continue;
            const text = oneLine(line.text, 200);
            if (!text) continue;
            const check = checkOf(line.check);
            out.push({
                module: String(moduleId ?? ''),
                icon: typeof line.icon === 'string' && ICON.test(line.icon) ? line.icon : 'fa-circle-info',
                text,
                summary: oneLine(line.summary ?? '', 80),
                flag: oneLine(line.flag ?? '', 160),
                note: oneLine(line.note ?? '', 160),
                // A check (`check`) is drawn as a row with its die; any other line is a tile. `tone` (good, bad, warn, info, accent)
                // rings the tile; a check's ring is its result.
                kind: check ? 'check' : 'line',
                tone: check ? check.result === 'success' ? 'good' : 'bad' : toneOf(line.tone),
                check,
            });
        }
    }
    return out;
}

// The RPG's lines (src/v2/lean-rpg/view/changes-lines.js) beside the others: "Rolled for you: 3 exchanges", "Wessel reached Lv 15
// (+1 point to spend)". A rise is told by its own line, so the plain "Rule: level-up" line the same rule leaves is left out then.
const RISE_RULE = /\b(class|level|rank|soul|xp|practice)\b/i;
export function mergeRpgLines(lines, rpg) {
    const own = Array.isArray(rpg) ? rpg : [];
    if (!own.length) return lines;
    const rises = own.some(item => item.icon === 'fa-arrow-up');
    return [...own, ...(rises ? lines.filter(item => !(item.icon === 'fa-bolt' && RISE_RULE.test(item.text))) : lines)];
}

const TONES = ['good', 'bad', 'warn', 'info', 'accent'];
const toneOf = value => (TONES.includes(value) ? value : 'info');
const whole = (value, low, high) => (Number.isInteger(value) && value >= low && value <= high ? value : null);

/**
 * A module's check (`check: { stat, what, d20, roll?, mod?, total?, dc, result?, story? }`) made ready for the card: the label
 * ("AGI — pursuing the wolf"), the modifier ("+ 1 DEX"), the result word, and the note when the story and the dice disagree.
 * Null when the die or the difficulty is not a whole number. `result`, when absent, is worked out from the total against the DC.
 */
function checkOf(raw) {
    if (!isRecord(raw)) return null;
    const d20 = whole(raw.d20, 1, 20);
    const dc = whole(raw.dc, -1000, 1000);
    if (d20 === null || dc === null) return null;
    const mod = whole(raw.mod ?? 0, -100, 100) ?? 0;
    const total = whole(raw.total ?? d20 + mod, -1000, 1000) ?? d20 + mod;
    const result = raw.result === 'success' || raw.result === 'fail' ? raw.result : total >= dc ? 'success' : 'fail';
    const story = raw.story === 'success' || raw.story === 'fail' ? raw.story : '';
    const stat = oneLine(raw.stat ?? '', 12).toUpperCase();
    const what = oneLine(raw.what ?? '', 120);
    const word = value => (value === 'success' ? C.success : C.fail);
    const roll = oneLine(raw.roll ?? '', 12);
    return {
        d20, dc, total, result, story,
        label: stat && what ? `${stat} — ${what}` : stat || what,
        modText: `${mod < 0 ? '−' : '+'} ${Math.abs(mod)}${stat ? ` ${stat}` : ''}`,
        rollText: roll ? fill(C.roll, { roll }) : '',
        word: word(result),
        disagree: story && story !== result ? fill(C.storyDice, { story: word(story), dice: word(result) }) : '',
    };
}
