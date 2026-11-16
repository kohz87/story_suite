// Text helpers the present scene readers and markup share: plain text, line cleaning and attribute escaping.
export const plain = value => (typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/g, ' ').trim() : '');

export const QUOTES_AT_ENDS = /^["“”'‘’«»]+|["“”'‘’«»]+$/g;
const EMPHASIS_AT_ENDS = /^[*_~]+|[*_~]+$/g;

export function cleanLine(text) {
    return plain(String(text).replace(EMPHASIS_AT_ENDS, '').trim().replace(QUOTES_AT_ENDS, '').replace(EMPHASIS_AT_ENDS, ''));
}

export const escapeAttr = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
