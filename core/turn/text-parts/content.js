// Content: reads and rewrites a prompt message's content, a string or a list of parts.

// Message content is a string or, for multimodal prompts, a list of parts.
export function mapContent(content, transform) {
    if (typeof content === 'string') return transform(content);
    if (!Array.isArray(content)) return content;
    return content.map(part => {
        if (typeof part === 'string') return transform(part);
        if (part && typeof part === 'object' && typeof part.text === 'string') return { ...part, text: transform(part.text) };
        return part;
    });
}
export function contentText(content) {
    const texts = [];
    mapContent(content, text => { texts.push(text); return text; });
    return texts.join('\n');
}
export const firstLine = text => String(text ?? '').split('\n').find(line => line.trim())?.trim() ?? '';
