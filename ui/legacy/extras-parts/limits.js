// Choices and Inner chatter: the caps of a reply's choices and chatter lines.

/** At most this many choices a reply. The narrator is asked for at most CHOICE_CHARS code points each; a longer
 * one is kept whole up to CHOICE_KEEP (the button wraps), so a click never sends a choice cut short (USER 5 Nov). */
export const CHOICE_MAX = 4;
export const CHOICE_CHARS = 80;
export const CHOICE_KEEP = 160;
/** At most this many chatter lines a reply; a thought at most CHATTER_CHARS code points, a name NAME_CHARS. */
export const CHATTER_MAX = 3;
