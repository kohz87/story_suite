// Noting a Story Suite console error or a failed save for the report.
import { ERRORS_KEPT } from './limits.js';
import { scrubLine } from './secrets.js';
import { caught, keep, textOf } from './shared-caught.js';

const PREFIXES = ['[Story Suite', '[Story Block', '[NPC State Delta', '[Story Director'];

/** A Story Suite console error (one of its prefixes), kept for the report: one line, made safe. */
export function noteError(parts) {
    const list = Array.isArray(parts) ? parts : [parts];
    const head = textOf(list[0] ?? '');
    if (!PREFIXES.some(prefix => head.startsWith(prefix))) return false;
    keep(caught.errors, { text: scrubLine(list.map(textOf).join(' ')) }, ERRORS_KEPT);
    return true;
}

/** A save that failed (index.js's onSaveError): counted, its message kept. */
export function noteSaveError(error) {
    caught.saveFailures += 1;
    keep(caught.saves, { text: scrubLine(error?.message ?? error, 200) }, 5);
}
