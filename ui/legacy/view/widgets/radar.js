// radar: a polygon chart over several axes (stats, affinities), with an optional "before" series drawn
// under the current one (a level-up preview, gear compared). The chart is SVG; a visually hidden list
// carries the same numbers for screen readers. The axis labels scale with the chart but never show
// smaller than LABEL_MIN_PX on screen (the chart's drawn width is watched where ResizeObserver exists).
//
// Public face: re-exports its parts.

export { LABEL_MIN_PX, labelUnits } from './radar-parts/labels.js';
export { radarAxes } from './radar-parts/axes.js';
export { radarPoint, radarPoints } from './radar-parts/points.js';
export { radar } from './radar-parts/widget.js';
