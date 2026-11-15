// Builds the manage api Story Suite's overlay uses to drive Delta's settings.
import { SOURCE_OF_TRUTH_CHOICES, SUITE_AREAS } from './identity.js';
import { normalizeSourceOfTruth } from './source-of-truth.js';
import { copyTokenEstimate, replyTokenEstimate } from './token-estimate.js';
import { replyPreview } from './reply-preview.js';
export function buildManageApi({ sources, setSource, enabled, setEnabled, tokens, preview } = {}) {
    return Object.freeze({
        /** (1.2.13) What Delta sends with the next ordinary reply ({ label, text, parts }); never throws. */
        preview: () => {
            try {
                const result = typeof preview === 'function' ? preview() : null;
                return replyPreview({ injection: result?.injection, capture: result?.capture });
            } catch (error) {
                console.warn('[NPC State Delta] Story Suite preview failed', error);
                return replyPreview();
            }
        },
        /** What Delta adds to the next ordinary reply ({ input, output, parts }); never throws. */
        tokens: () => {
            try {
                return copyTokenEstimate(typeof tokens === 'function' ? tokens() : null);
            } catch (error) {
                console.warn('[NPC State Delta] Story Suite token estimate failed', error);
                return replyTokenEstimate();
            }
        },
        areas: SUITE_AREAS,
        sources: () => ({ ...normalizeSourceOfTruth(sources?.()) }),
        setSource: (area, choice) => {
            if (!SUITE_AREAS.includes(area) || !SOURCE_OF_TRUTH_CHOICES.includes(choice)) return false;
            setSource?.(area, choice);
            return true;
        },
        enabled: () => enabled?.() !== false,
        setEnabled: on => {
            setEnabled?.(Boolean(on));
        },
    });
}
