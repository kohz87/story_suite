/* NPC State Delta: whether the automatic scan is due after a reply. */

// With Story Suite's "Scan after every reply" switched off the automatic scan runs this often at the most.
export const AUTO_SCAN_EVERY_WITHOUT_EVERY_REPLY = 3;

/**
 * Whether the automatic scan is due after this reply. `sinceScan` counts the replies since the last scan, `scanEvery` is
 * the reader's "Scan every" setting, `full` is "Full scan every turn". `everyReply` is the "Scan after every reply"
 * switch (true when no Story Suite is present): off, a scan waits for three replies, or for "Scan every" when that is
 * larger, and "Full scan every turn" then makes that scan a full one instead of making every reply scan.
 */
export function autoScanDue({ autoScan, full, sinceScan, scanEvery, everyReply = true, replyChanges = false, catchUp = false } = {}) {
    if (!autoScan) return false;
    // The last scan could not read every waiting reply: the next reply scans at once, whatever the cadence, until caught up.
    if (catchUp) return true;
    // `replyChanges`: the cheap local check found a name or an NPC State line in the reply. A quiet reply waits for
    // the safety scan (every `scanEvery` replies); "Scan every" 1 therefore still scans every reply.
    if (everyReply !== false) return Boolean(full) || Boolean(replyChanges) || sinceScan >= scanEvery;
    // Off, only the cadence applies (no earlier than 1.7.4); the scan then reads every reply since the last one.
    return sinceScan >= Math.max(AUTO_SCAN_EVERY_WITHOUT_EVERY_REPLY, Number(scanEvery) || 1);
}
