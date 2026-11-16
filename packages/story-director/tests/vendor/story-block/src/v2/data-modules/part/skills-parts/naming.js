// Matching a reason against skill names: the matcher's text, the skills a reason names, the one it names.

// A skill name or a reason as the matcher compares it: NFKC, lower case, runs of spaces and dashes as one space.
export const words = value => ` ${String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\-‐‑–—_]+/gu, ' ').replace(/[^\p{L}\p{N} ]/gu, '').replace(/ +/gu, ' ').trim()} `;
// Skills a reason names (whole words; of two names inside it, the longer one if the shorter is part of it).
export function skillsNamed(slots, reason) {
    const text = words(reason);
    const found = slots.filter(slot => slot.name && words(slot.name).trim() && text.includes(words(slot.name)));
    const top = found.filter(slot => !found.some(other => other !== slot && words(other.name).includes(words(slot.name)) && words(other.name) !== words(slot.name)));
    return top;
}
export const skillNamed = (slots, reason) => { const found = skillsNamed(slots, reason); return found.length === 1 ? found[0] : null; };
