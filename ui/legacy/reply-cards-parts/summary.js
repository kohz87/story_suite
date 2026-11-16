// Joins the sections' summaries into the closed one-line card.

/** Between one section's summary and the next on the closed line. */
export const SUMMARY_JOIN = ' · ';

/** The closed line: the sections' summaries (empty ones left out) joined with " · ". */
export function mergeSummaries(parts) {
    return (Array.isArray(parts) ? parts : []).map(part => String(part ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(SUMMARY_JOIN);
}
