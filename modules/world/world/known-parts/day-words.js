// Story Director v2, world: the relative-day wording ("tomorrow", "3 days ago").

/** "today", "tomorrow", "in 3 days", "yesterday", "3 days ago". */
export function daysText(days) {
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days === -1) return 'yesterday';
    return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** "today", "yesterday", "3 days ago" (whole story days back). */
export const agoText = days => (days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`);
