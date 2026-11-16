/* The widths and node counts at which the relationship map shortens its face labels. */
// Below this width of the circle itself a face shows its short name and no number (the labels would meet): about 5 labels around the ring (64px each).
export const MAP_LABELS_SHORT_MAX = 520;
// Below this width of the circle the labels of ten faces with their names and numbers meet: the short name alone.
export const MAP_NAMES_MIN = 340;
// With more faces than this a narrow circle shows the short names alone (full names and numbers for up to this many).
export const MAP_DENSE_NODES = 12;
