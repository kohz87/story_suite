// What NPC State sends with the next ordinary reply, as text parts with a token estimate (about four characters a token).
const tokensFor = chars => Math.ceil(Math.max(0, Number(chars) || 0) / 4);

/**
 * { label, text, parts: [{ label, text, tokens }] } (empty parts left out). Never throws.
 */
export function replyPreview({ injection = '', rules = '', capture = '' } = {}) {
    try {
        const parts = [
            { label: 'Live dossier', text: String(injection ?? '') },
            { label: 'One-pass rules (system prompt)', text: String(rules ?? '') },
            { label: 'One-pass capture instruction (end of the prompt)', text: String(capture ?? '') },
        ].filter(part => part.text).map(part => ({ ...part, tokens: tokensFor(part.text.length) }));
        return { label: 'NPC State Delta', text: parts.map(part => part.text).join('\n\n'), parts };
    } catch {
        return { label: 'NPC State Delta', text: '', parts: [] };
    }
}
