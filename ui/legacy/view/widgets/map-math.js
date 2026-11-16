// Pure maths for the map widget: world bounds, the view rectangle (what part of the world is shown),
// zoom about a point, pan with limits, screen ↔ world conversion, the minimap's viewport box, and the
// deterministic auto-layout for nodes that have no coordinates.
//
// A view is `{ x, y, w, h }` in world units: the rectangle of the world the stage shows. Its aspect
// (w / h) always matches the stage's, so the SVG (preserveAspectRatio="none") and the HTML node layer
// line up exactly.
//
// Public face: re-exports its parts.

export { DEFAULT_ASPECT, ZOOM_IN_LIMIT, ZOOM_OUT_LIMIT } from './map-math-parts/limits.js';
export { worldBounds, fitView, withAspect, zoomLevel } from './map-math-parts/bounds.js';
export { zoomAt, panBy, clampView, centerOn } from './map-math-parts/zoom-pan.js';
export { clientToWorld, unitsPerPixel, toPercent } from './map-math-parts/coords.js';
export { minimapBox, minimapToWorld } from './map-math-parts/minimap.js';
export { autoLayout } from './map-math-parts/layout.js';
