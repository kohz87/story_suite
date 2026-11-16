/* Removing an age look that disagrees with the record's stored apparent age. A part of appearance-fill.js (same owner, moved without change). */
// A fill never contradicts a stored value. The stored apparentAge ("~20") is a number; a filled look that names an age look outside it
// ("apparent mid-twenties" for ~20) loses that phrase (words only removed, none added). Story-given looks are never touched: this runs on fill writes.
const DECADES = { teens: [13, 19], twenties: [20, 29], thirties: [30, 39], forties: [40, 49], fifties: [50, 59], sixties: [60, 69], seventies: [70, 79] };
const PART_OF = { early: [0, 3], mid: [4, 6], late: [7, 9] };
const AGE_LOOK = /(?:\s*(?:,|;)?\s*(?:of|in\s+(?:her|his|their|its))\s+)?(?:(?:an?\s+)?apparent(?:ly)?\s+)?(?:(early|mid|late)[- ]?)?(teens|twenties|thirties|forties|fifties|sixties|seventies)\b/i;
export const storedAge = npc => { const found = String(npc?.apparentAge ?? '').match(/\d+/); return found ? Number(found[0]) : null; };

/** `text` with an age look that disagrees with the record's stored apparentAge removed; the text itself when none, or nothing is stored. */
export function agreeWithStoredAge(text, npc) {
    const value = String(text ?? '');
    const age = storedAge(npc);
    if (age === null) return value;
    const match = value.match(AGE_LOOK);
    if (!match) return value;
    const [from, to] = DECADES[match[2].toLowerCase()];
    const part = PART_OF[(match[1] || '').toLowerCase()];
    const [lo, hi] = part ? part.map(n => from + n) : [from, to];
    if (age >= lo - 1 && age <= hi + 1) return value;
    return value.replace(AGE_LOOK, '').replace(/\s{2,}/g, ' ').replace(/\s+([,;.])/g, '$1');
}
