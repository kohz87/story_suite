// Flattens slot values to plain text and fills a line's name and place.

export const SLOT_MAX = 60;

/** A slot value as plain text: no braces, angle brackets or line breaks; collapsed spaces; cut by code points. */
export function plainSlot(value, max = SLOT_MAX) {
    const text = String(value ?? '').replace(/[{}<>\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    return Array.from(text).slice(0, max).join('');
}

/** The line with {name} and {place} filled; '' when it names someone and there is no name. {place} falls back to "here". */
export function fillSlots(text, { name = '', place = '' } = {}) {
    const line = String(text ?? '');
    const who = plainSlot(name);
    if (line.includes('{name}') && !who) return '';
    return line.replaceAll('{name}', who).replaceAll('{place}', plainSlot(place) || 'here');
}
