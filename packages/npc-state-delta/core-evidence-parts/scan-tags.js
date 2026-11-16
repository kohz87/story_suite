/* NPC State Delta profile evidence: tagging a scan reply's profile evidence with its message id. */


/**
 * (1.2.11) A scan of one reply (an automatic quick scan, or a one-pass block) writes its profile
 * evidence without a message tag: tagged with that reply ("[m12] …"), a habit seen again in a later
 * reply counts as a second sighting however alike the words. Tagged items are left as they are.
 * Returns a copy; the input is not touched.
 */
export function tagScanEvidence(parsed, messageId) {
    if (!parsed || typeof parsed !== 'object' || !Number.isInteger(messageId) || messageId < 0) return parsed;
    const rows = Array.isArray(parsed.profileUpdates) ? parsed.profileUpdates : (Array.isArray(parsed.profile_updates) ? parsed.profile_updates : null);
    if (!rows) return parsed;
    const tag = item => (typeof item === 'string' && item.trim() && !/^\s*\[m\d+\]/i.test(item) ? `[m${messageId}] ${item.trim()}` : item);
    const tagged = rows.map(row => {
        const evidence = row?.evidence;
        if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return row;
        return { ...row, evidence: Object.fromEntries(Object.entries(evidence).map(([field, list]) => [field, Array.isArray(list) ? list.map(tag) : list])) };
    });
    return Array.isArray(parsed.profileUpdates) ? { ...parsed, profileUpdates: tagged } : { ...parsed, profile_updates: tagged };
}
