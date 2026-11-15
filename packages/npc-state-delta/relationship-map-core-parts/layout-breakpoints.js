/* The widths at which the relationship map puts its card beside the map. */
// The card goes beside the map (not under it) when both fit: the map at its smallest readable size, the card at its narrowest and the
// room around them. Derived from content, never from a device. relationship-map.js's @container line imports it.
export const MAP_CIRCLE_MIN = 380;
export const MAP_CARD_MIN = 240;
export const MAP_ROOM = 2 * 18 + 14; // side padding of the map pane and the gap between map and card
export const MAP_CARD_BESIDE_MIN = MAP_CIRCLE_MIN + MAP_CARD_MIN + MAP_ROOM;
