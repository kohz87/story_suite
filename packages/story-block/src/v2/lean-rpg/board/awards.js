// Selects the opening foe groups for a board fight's single win award.
// It reads the current reply's recorded board result, including fights split across replies.
// A still-open, lost or fled board fight never pays a win award.

import { isRollReceipt } from './results.js';

export function boardWin(receipts) {
    const receipt = (Array.isArray(receipts) ? receipts : []).findLast(item => isRollReceipt(item) && item.data?.v2?.result?.board);
    const result = receipt?.data?.v2?.result;
    if (!result) return null;
    return { won: result.stop === 'won', ...(result.board.v1 === 1 ? { v1: true } : {}), groups: Array.isArray(result.board.groups) ? result.board.groups : [], bars: result.bars === 2, cleared: Array.isArray(result.cleared) && result.cleared.length > 0,
        claim: typeof receipt.data?.v2?.key === 'string' ? receipt.data.v2.key : null,
        // (a v1 settle that practised skills: the skills, for the step that puts back the story's own practice on them, fight-parts/hold-v1.js)
        ...(result.board.v1 === 1 && Array.isArray(result.award?.uses) ? { uses: result.award.uses.map(use => ({ who: use.who, skill: use.skill })) } : {}) };
}
