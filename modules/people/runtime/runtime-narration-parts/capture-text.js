// Reading a reply's own one-pass block for the edit rebuild, and the rule mark that tells a live read from a replayed one.

import { extractNarrationCapture, parseNarrationCapture } from '../../core/core.js';
import { narrationCaptureEnabled } from '../../calls/runtime-scan-helpers.js';

// (EDITKEEP) The one-pass block a reply still carries in its own text, read for the edit rebuild only (never a journal fallback: an old or
// swiped reply with no entry stays a historical read). The rebuild scan records it as a real journal entry under the new key. Only a complete, parseable block counts; none in the text, none here.
export function textCapture(message) {
    if (!message || message.is_user || !narrationCaptureEnabled()) return null;
    const extracted = extractNarrationCapture(message.mes);
    const parsed = extracted.status === 'found' ? parseNarrationCapture(extracted.raw) : null;
    return parsed ? { parsed, raw: extracted.raw, watch: [] } : null;
}
// Rule mark: historical replies without this mark keep the prompt rules under which they were read.
export const backgroundRuleOn = (replaying, entry) => !replaying || entry?.backgroundRule === 1;
