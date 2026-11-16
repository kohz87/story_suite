// Label font size, box sizing, and slot order constants for map labels.

export const LABEL_FONT_PX = 12;
const CHAR_PX = LABEL_FONT_PX * 0.56;
const LABEL_H = LABEL_FONT_PX + 6;

/** A label's box size in pixels, estimated from its text (the same text always gets the same size). */
export const labelSize = text => ({ w: Math.ceil(String(text).length * CHAR_PX + 8), h: LABEL_H });

// The eight places a label may sit around its marker, in the order they are tried.
export const SLOTS = Object.freeze(['e', 'w', 'ne', 'se', 'nw', 'sw', 'n', 's']);
