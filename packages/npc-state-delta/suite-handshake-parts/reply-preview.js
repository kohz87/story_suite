// Previews, as text, what Delta sends with the next ordinary reply.
import { tokensFor } from './shared-tokens.js';
/**
 * What Story Suite's overlay uses to manage Delta (docs/STORY_SUITE.md, api.manage). The
 * callbacks are Delta's own settings actions; this wrapper only validates and copies. setSource
 * returns false, without calling back, for an unknown area or choice.
 */
/**
 * (1.2.13) What Delta sends with the next ordinary reply, as text: { label, text, parts:
 * [{ label, text, tokens }] } (empty parts left out). Never throws.
 */
export function replyPreview({ injection = '', capture = '' } = {}) {
    try {
        const parts = [
            { label: 'Live dossier', text: String(injection ?? '') },
            { label: 'One-pass capture instruction (end of the prompt)', text: String(capture ?? '') },
        ].filter(part => part.text).map(part => ({ ...part, tokens: tokensFor(part.text.length) }));
        return { label: 'NPC State Delta', text: parts.map(part => part.text).join('\n\n'), parts };
    } catch {
        return { label: 'NPC State Delta', text: '', parts: [] };
    }
}
