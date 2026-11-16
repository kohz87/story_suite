// Story Director v2, atlas part: the Map widget `story-director.map` (MODULES §F9 namespaced widget).
//
// Draws `atlas.view` (map.js `atlasView`): routes as SVG lines in stage pixels (one view transform,
// view.js `toScreen`, for routes and places alike; each line cut to the stage, so a street seen at a
// country's zoom never becomes a line a million pixels long), places as buttons over it, their names placed so none overlaps another (view.js
// `placeLabels`), and the "you are here" ring above everything. The reader can:
// * pan (drag, one finger, arrow keys) and zoom (wheel about the pointer, pinch, + / − buttons and
//   keys, 0 or "Fit" for the whole layer, "Me" to centre on the current place), inside the zoom
//   limits and never off the world; unvisited places get their icon, then their name, as the map
//   comes closer, and hover or focus shows any place's name;
// * switch layers with the Region list beside the search box: All, then each region and plane that has places;
// * search places by name, alias or region (unvisited ones too, marked "not visited"); picking one
//   moves the map to it and shows it;
// * pick a place (click, tap, Enter) for its details: kind, region, visited or not, and the trip
//   from the current place by known routes (query `atlas.place`, travel.js).
// * a trip (feature `story-director.trip`, query `atlas.trip` as the prop `trip`): its route drawn as a thick accent line over the known
//   routes, a "You" marker at the derived point along the current leg, the movers {{user}} knows of as diamonds on their leg, and an "On the
//   road" panel (destination, mode and pace, each leg with a progress bar on the current one, the movers). The panel sits over the map's
//   corner; on a phone it goes under the map.
// The view (centre and zoom) is the reader's alone: kept in memory per layer for this page, never
// in the story state. Picking a place writes nothing either (a screen may still pass `onSelect`).
// Moves to a picked place are eased, except under prefers-reduced-motion.
// Story Block draws its screens zoomed (its size.css): pointer and measured positions are drawn pixels, the stage's own
// lengths (style.left, the view) are not, so every measure is divided by the stage's zoom (zoomOf).
//
// The stylesheet is in widget-css.js; the prop readers and small helpers are in widget-view.js; the drawing is in widget-draw.js;
// the DOM is built in widget-dom.js; place details, search and moves are in widget-places.js; pointer input is in widget-pointer.js.
//
// Public face: re-exports its parts.

export { MAP_CSS } from './widget-css.js';
export { onLayer, readTrip, readView } from './widget-view.js';
export { forgetViews } from './widget-parts/views.js';
export { MAP_WIDGET, atlasMapWidget } from './widget-parts/definition.js';
