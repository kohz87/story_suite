// Flattens any value to one trimmed line of text, for the opening parts.
export const oneLine = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
