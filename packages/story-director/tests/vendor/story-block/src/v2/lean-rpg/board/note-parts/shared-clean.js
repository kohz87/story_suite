// Flattens a value to one trimmed line of text for the narrator note.

export const clean = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
