// Finds the narrator's `[battle]` marker in a drawn message, hides markers without a panel, takes a panel out again,
// and puts a panel where the first marker line stood. Text nodes are split and moved; no markup is parsed.
// Public face: re-exports its parts.

export { nodesOf } from './marker-parts/shared-nodes.js';
export { markerNodes } from './marker-parts/find.js';
export { MARKER_HIDDEN, isHiddenMarker, hideMarkers } from './marker-parts/hide.js';
export { CONSUMED, releasePanel, placeAtMarker } from './marker-parts/place.js';
