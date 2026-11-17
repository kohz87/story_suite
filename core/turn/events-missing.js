// Story Suite v2: the Problems row for a reply that came with no <Changes> block and was not repaired (CHGDROP fix 4): never silent.

import { assistSections } from '../capture.js';

/** What the hooks made of a reply with no block: the repair's word ('failed', 'nothing', 'ok'), else 'off' (no repair ran). */
export function repairOutcome(results = []) {
    const list = results.filter(item => item && typeof item === 'object' && typeof item.repair === 'string');
    return list.length ? list[0].repair : 'off';
}

const WHY = Object.freeze({
    off: 'No change block came with this reply, so nothing in it was recorded.',
    failed: 'No change block came with this reply, and the repair call failed, so nothing in it was recorded.',
    nothing: 'No change block came with this reply, and the repair found nothing to record.',
});

/**
 * The Problem for reply `index` when it has no block and holds no stored lines of the repair or the safety net (`mes`, as saved), else null.
 * `outcome`: repairOutcome(). Same wording live and when asked again.
 */
export function missingProblem(index, mes, outcome) {
    const stored = assistSections(String(mes ?? ''));
    if (stored.now.length || stored.next.length) return null;
    return { index, code: 'NO_CHANGES', message: `${WHY[outcome] ?? WHY.off} Press Re-read after adding its <Changes> block, or edit the story by hand.` };
}
