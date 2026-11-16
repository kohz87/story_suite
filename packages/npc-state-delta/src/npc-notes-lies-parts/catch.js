// Catching a lie: stamping the latest matching uncaught lie and returning its trust change.
import { LIE_TO_MAX, LIE_SAID_MAX } from './shared-limits.js';
import { clip, sameName } from './shared-text.js';
import { replyOk, dayOk } from './shared-valid.js';
import { CAUGHT_TIER, CAUGHT_DROP, caughtChange } from './caught-rule.js';
import { listOf } from './read.js';

const TIERS = ['ordinary', 'meaningful', 'major', 'extreme'];

/**
 * Stamps the latest uncaught lie to `to` (and, when given, whose words contain `said`, ignoring case) as caught at { day, r }.
 * → { text, entry, change } with `change` the trust change at `tier` (see caughtChange), or null when no lie matches or the
 * tier or drop is not usable.
 */
export function catchLie(prior, { to, said, day = null, r, tier = CAUGHT_TIER, drop = CAUGHT_DROP } = {}) {
    const teller = clip(to, LIE_TO_MAX);
    const words = clip(said, LIE_SAID_MAX).toLowerCase();
    if (!teller && !words) return null;
    if (!TIERS.includes(tier) || !Number.isSafeInteger(drop) || drop <= 0 || !dayOk(day) || !replyOk(r)) return null;
    const list = listOf(prior);
    let at = -1;
    list.forEach((item, i) => {
        if (item.caught) return;
        if (teller && !sameName(item.to, teller)) return;
        if (words && !item.said.toLowerCase().includes(words)) return;
        at = i;
    });
    if (at < 0) return null;
    const entry = { ...list[at], caught: { day, r } };
    const next = list.map((item, i) => (i === at ? entry : item));
    return { text: JSON.stringify(next), entry, change: caughtChange(tier, drop) };
}
