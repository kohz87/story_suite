// Places: the ones the story has been to, read from the scene block's location, and what a
// map's coordinates say about them.
//
// Every reply's World State names where the scene is ("Auvoth | Seventh Seal Terrace"), and
// many presets add map coordinates ("[59.0, 110.0]"). Replayed in order, those make a place
// book without anyone writing a world pack: each place (the first part of the location),
// the spots inside it (the rest), how often and when the story was there, and its latest
// coordinates. A world pack's places add coordinates for places the story has not reached,
// and win over the story's for places it knows (0.8.8): the pack is the reader's own map, while
// a reply's coordinates are the model's and drift; a disagreement is kept so it can be shown.
//
// The map settings say how to read coordinates: which way north and east run (a picture's
// y grows downwards, a chart's upwards) and how many km one unit is. From those come
// distances, compass directions, places "nearby", and a travel estimate by straight line
// times a road factor (roads wind), counted with the same round-up and rest-day rules as a
// world pack's roads. Pure.
// Public face: re-exports its parts.

export { DEFAULT_MAP, DEFAULT_PACES, MODERN_PACES, mapSettings } from './places-parts/settings.js';
export { parseLocation, buildPlaceBook, findBookPlace } from './places-parts/book.js';
export { distanceKm, bearing, nearbyByCoords } from './places-parts/geometry.js';
export { estimateTrip, formatTrip } from './places-parts/trip.js';
