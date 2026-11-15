// The reader-facing words for a refused command.
import { STRINGS } from './table.js';

/** What a reader sees when a command was refused: a full reply budget or a chat that holds as many block versions as it can, in plain words (`pinsFull` words the second), else the refusal's own sentence (or `fallback`). */
export function refusalText(result, fallback = '', { pinsFull = STRINGS.editMessages.pinsFull } = {}) {
    if (result?.code === 'DM_BUDGET') return /Retained pin budget exhausted/.test(String(result.message ?? '')) ? pinsFull : STRINGS.editMessages.replyFull;
    return result?.message || fallback;
}
