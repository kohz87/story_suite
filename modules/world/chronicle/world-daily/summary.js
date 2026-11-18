// World events, the daily step on the host: the one line its changes card shows (reader-facing, not sent to the narrator).
// What happened (fired, ended, lapsed, replaced, minor happenings, people moved or lost, conditions that faded), the long-skip note,
// then the warnings. Pure.

const MAX_ITEMS = 8;
const MAX_CHARS = 1200;

/** `dailySummary(report)` → '' when nothing happened, else "World: …". */
export function dailySummary(report) {
    const items = report.journal.filter(entry => !entry.rumour).map(entry => entry.text);
    for (const entry of report.log) {
        if (entry.kind === 'lapsed') items.push(`Lapsed: ${entry.key}.`);
        if (entry.kind === 'replaced') items.push(`Replaced: ${entry.key}.`);
        if (entry.kind === 'faded' || entry.kind === 'released') items.push(`Faded: ${entry.key.replace('@', ' on ')}.`);
    }
    const shown = items.slice(0, MAX_ITEMS);
    if (items.length > MAX_ITEMS) shown.push(`and ${items.length - MAX_ITEMS} more.`);
    const parts = [];
    if (report.note) parts.push(`${report.note}.`);
    if (shown.length) parts.push(shown.join(' '));
    for (const warning of report.warnings.slice(0, 4)) parts.push(`Warning: ${warning}`);
    if (!parts.length) return '';
    const text = `World: ${parts.join(' ')}`;
    return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text;
}
