// Story Director v2, atlas part: the Map widget's prop readers and small helpers.
//
// `readView` and `readTrip` clean the widget's props, `onLayer` and `layerFor` say which layer a place is on,
// and the value and DOM helpers (`text`, `num`, `px`, `fmt`, `humanize`, `h`, `button`, `icon`) are what widget.js
// draws with. Split out of widget.js; widget.js still exports `readView`, `readTrip` and `onLayer`.
//
// Public face: re-exports its parts.

export { button, h, icon } from './widget-view-parts/dom.js';
export { fmt, humanize, px, text } from './widget-view-parts/format.js';
export { ALL, layerFor, onLayer } from './widget-view-parts/layers.js';
export { readTrip, readView } from './widget-view-parts/readers.js';
