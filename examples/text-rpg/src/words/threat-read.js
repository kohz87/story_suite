// Reading a threat word a narrator wrote: the sheet's words, and the short forms of them.
import { THREAT_WORDS } from './threat.js';

/** The threat index (0 far beneath … 5 beyond) a text names (`beneath`, `a fair match`, `far above you`, …), or -1. */
export function readThreat(text) {
    const word = String(text ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/^(?:a|an|the)\s+/, '').replace(/\s+(?:you|match|to you)$/, '');
    const at = THREAT_WORDS.findIndex(item => item.replace(/^(?:a|an|the)\s+/, '').replace(/\s+(?:you|match)$/, '') === word);
    return at;
}
