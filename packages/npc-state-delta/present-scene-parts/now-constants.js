// The labelled now lines of a present card: their length limits, labels and the look label.
// Each labelled now line shows up to NOW_PART_MAX characters (the card clamps it to two lines) and
// carries up to NOW_TITLE_MAX in its tooltip, so a long mood or outfit stays readable.
export const NOW_PART_MAX = 160;
export const NOW_TITLE_MAX = 400;
export const NOW_PARTS = Object.freeze([['mood', 'Mood'], ['condition', 'Condition'], ['outfit', 'Outfit']]);
export const DOSSIER_LOOK_LABEL = 'Look';
