// Capturing taste lines: adding one taste under the first-mention rule and merging a Refresh into the list.
import { clean } from '../npc-meters-config.js';
import { TASTE_LIMITS, TASTE_RULE, LIKE, DISLIKE } from './shared-limits.js';
import { tidy, tasteWords, tasteKey } from './words.js';
import { isSign, verb, limitOf } from './shared-signs.js';
import { replyTag, capped, readTastes, tastesText } from './record.js';
import { mirrorCheck, mirrorWording } from './mirror.js';

const wholeDay = day => (Number.isInteger(Number(day)) && Number(day) >= 0 ? Number(day) : 0);

const outcome = (tastes, status, problem = '', cue = '', entry = null) => ({ tastes, status, problem, cue, entry });

/**
 * Captures one taste line. Statuses: 'added' (new item), 'changed' (the opposite sign, allowed only with why:), 'same' (already
 * there, a no-op), 'refused' (no item or sign, or an opposite sign without why:; the list is unchanged and problem says why).
 * A mirrored taste is still stored (mirrored: true) with its problem and cue. The entry keeps its reply tag r, so a re-read replaces it.
 */
export function addTaste(current, { name = '', sign, item, from = '', why = '', day = 0, r = null, userText = '', rule = TASTE_RULE } = {}) {
    const list = readTastes(current, { cite: false });
    const words = rule === TASTE_RULE ? tasteWords : tidy;
    const text = words(item, TASTE_LIMITS.item);
    const key = tasteKey(text);
    const who = clean(name, 60) || 'The NPC';
    if (!isSign(sign) || !key) return outcome(list, 'refused', 'A taste line needs a likes: or dislikes: item.');
    const oldKey = tasteKey(tidy(item, TASTE_LIMITS.item));
    const same = list.find(row => [key, oldKey].includes(tasteKey(tidy(row.item, TASTE_LIMITS.item))));
    if (same?.sign === sign) return outcome(list, 'same');
    if (same && !clean(why, TASTE_LIMITS.why)) {
        return outcome(list, 'refused', `${who} already ${verb(same.sign)} ${tidy(same.item, TASTE_LIMITS.item)}; a change needs a why: reason.`);
    }
    const fromText = words(from, rule === TASTE_RULE ? TASTE_LIMITS.from : 60); // old rule: the original 60 cut
    const mirror = mirrorCheck({ userText, item: text, from: fromText, why, existing: list });
    const entry = {
        sign,
        item: text,
        ...(fromText ? { from: fromText } : {}),
        day: wholeDay(day),
        r: replyTag(r),
        ...(mirror.mirrored ? { mirrored: true } : {}),
        ...(rule === TASTE_RULE ? { rule: TASTE_RULE } : {}),
    };
    const tastes = capped([...list.filter(row => row !== same), entry]);
    const status = same ? 'changed' : 'added';
    if (!mirror.mirrored) return outcome(tastes, status, '', '', entry);
    const wording = mirrorWording(who, sign, text);
    return outcome(tastes, status, wording.problem, wording.cue, entry);
}

/**
 * A Refresh's tastes (rows { sign, item, from }) merged into the stored list like `~ taste` lines: same caps and dedupe, first mention
 * wins. A taste already there (either sign) is kept as it is, and a sign whose list is full takes nothing more, so a narrator's or the
 * player's taste is never changed or pushed out. → { text, added } (`added`: how many rows were new; `text` is the whole new leaf).
 */
export function mergeRefreshTastes(current, rows, { name = '', day = 0, r = null } = {}) {
    let list = readTastes(current, { cite: false });
    let added = 0;
    for (const row of (Array.isArray(rows) ? rows : []).slice(0, TASTE_LIMITS.likes + TASTE_LIMITS.dislikes)) {
        const sign = row?.sign === 'like' ? LIKE : (row?.sign === 'dislike' ? DISLIKE : row?.sign);
        if (!isSign(sign) || list.filter(item => item.sign === sign).length >= limitOf(sign)) continue;
        const out = addTaste(list, { name, sign, item: row.item, from: row.from, day, r });
        if (out.status !== 'added') continue;
        list = out.tastes;
        added += 1;
    }
    return { text: tastesText(list), added };
}
