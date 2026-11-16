// Story Director v2, atlas part: the Map widget's maths (pure, no DOM).
//
// Map space: the world's coordinates turned the way the reader's map settings say (north up puts a
// larger y higher on screen; east left mirrors x). A view is `{ cx, cy, k }`: the map-space point at
// the stage's centre and the zoom in pixels per map unit. Everything here is deterministic: the same
// places, stage size and view always give the same picture, the same labels and the same search hits.
//
// Public face: re-exports its parts.

export { MAX_ZOOM_SPAN, NEAR_PX, ZOOM_IN, ZOOM_OUT } from './view-parts/constants-zoom.js';
export { FIT_PAD, KNOWN_ICON_ZOOM, KNOWN_LABEL_ZOOM, LONE_SPAN } from './view-parts/constants-view.js';
export { boundsOf, fitView, mapPoint, nearestGap } from './view-parts/geometry.js';
export { clampView, toMap, toScreen, zoomLimits } from './view-parts/transform.js';
export { centreOn, panBy, zoomAt, zoomLevel } from './view-parts/camera.js';
export { between, clipSegment, placeUnplaced } from './view-parts/layout.js';
export { LABEL_FONT_PX, SLOTS, labelSize } from './view-parts/label-metrics.js';
export { placeLabels, shorten } from './view-parts/labels.js';
export { fold, searchPlaces } from './view-parts/search.js';
