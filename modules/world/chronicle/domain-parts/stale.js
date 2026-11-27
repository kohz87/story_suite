// When open world news has gone too long without word to count as current (read time only: worked out from the state, nothing stored).

import { isOpen } from './order.js';
import { isInt } from './shared-basics.js';

/** Story days with no update after which open news is old. */
export const STALE_NEWS_DAYS = 30;

/**
 * Whether the open event (a chronicle entry or a query's copy of one) has had no word for STALE_NEWS_DAYS story days at `now`. The last
 * word is its latest `updated`, or the time its news arrived (`arrivesAt`) when that is later. False while the clock or the stamp is
 * unknown. Never old: an entry the reader keeps (`keep`), one a pack's timeline wrote (`by`, `locked`: the timeline ends it) and a
 * pulse rumour (it has its own expiry).
 */
export function isStaleNews(event, now) {
    if (!isOpen(event) || event.keep === true || event.locked === true || typeof event.by === 'string' || typeof event.rumour === 'string') return false;
    if (!isInt(now) || !isInt(event.updated)) return false;
    const last = isInt(event.arrivesAt) && event.arrivesAt <= now ? Math.max(event.updated, event.arrivesAt) : event.updated;
    return now - last >= STALE_NEWS_DAYS * 1440;
}
