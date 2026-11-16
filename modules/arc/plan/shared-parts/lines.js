// Story Director v2, part **arc**: regular expressions for matching plan line prefixes and fences.

export const DECORATION = /^(?:#{1,6}\s+|>\s*|(?:[*•+-]|\d{1,2}[.)])\s+)+/;
export const LABEL_LINE = /^([A-Za-z]+)\s*:\s*(.*)$/s;
export const FENCE = /^(?:```|~~~)/;
