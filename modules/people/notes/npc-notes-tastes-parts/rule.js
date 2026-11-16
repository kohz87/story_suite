// The taste rule marks: which rule a taste write follows and the receipt data that records it.
import { clean } from '../npc-meters-config.js';
import { TASTE_LIMITS, TASTE_RULE } from './shared-limits.js';
import { tidy, tasteWords, tasteKey } from './words.js';
import { readTastes } from './record.js';

// Rule marks: rows mark writes; receipts also mark no-op lines, so a Re-read of a duplicate uses the same item rule.
export function tasteRuleFor(standing, key, reply, item, receipts = []) {
    if (!standing) return TASTE_RULE;
    const raw = tidy(item, Infinity);
    const keys = [tasteKey(clean(raw, TASTE_LIMITS.item)), tasteKey(tasteWords(raw, TASTE_LIMITS.item))];
    if (Array.isArray(receipts) && receipts.some(receipt => receipt?.type === 'capture.taste' && receipt.data?.key === key
        && receipt.data?.tasteRule === TASTE_RULE && receipt.data?.tasteItem === keys[1])) return TASTE_RULE;
    const rows = readTastes(standing.domains?.npc?.npcs?.[key]?.tastes, { cite: false });
    return rows.some(row => row.r === reply && row.rule === TASTE_RULE && keys.includes(tasteKey(tidy(row.item, Infinity)))) ? TASTE_RULE : 0;
}

export const markTasteResult = (result, item, rule) => rule === TASTE_RULE
    ? { ...result, data: { ...result.data, tasteRule: TASTE_RULE, tasteItem: tasteKey(tasteWords(item, TASTE_LIMITS.item)) } } : result;
