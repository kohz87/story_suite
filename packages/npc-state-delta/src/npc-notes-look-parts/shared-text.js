// The look text helpers every look part shares: the cleaner, the plain-object test and the capped locked look text.
export const LOOK_TEXT_MAX = 160;

export const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
export const clean = (value, max) => [...String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('');

/** The locked look text, cleaned and capped to LOOK_TEXT_MAX ('' when there is none). */
export function lookText(value) {
    return clean(value, LOOK_TEXT_MAX);
}
