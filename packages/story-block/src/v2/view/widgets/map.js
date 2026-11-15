// map: places and routes, with layers (floors, surface/underground), the reader's position, fog over
// undiscovered places, pan (pointer drag, arrow keys), zoom (wheel, pinch, +/− buttons and keys, reset),
// a minimap with the viewport box, and a legend of the kinds on show.
//
// Routes are drawn in an SVG in world units; places are HTML elements over it, positioned by the custom
// properties `--ss-w-x` / `--ss-w-y` (percent of the stage), so their icons can be Font Awesome glyphs,
// their names stay crisp at any zoom, and each selectable place is a real button (focus, Enter, Space).
// Clicking a place runs `onSelect` with `{ node: <id> }` when the screen gives a command.
//
// Public face: re-exports its parts.

export { map } from './map-parts/widget.js';
export { mapEdges, mapLayers, mapNodes, visibleOnLayer } from './map/data.js';
