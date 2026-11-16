// Story Director v2, atlas part: the map as Story Block's `ss.map` widget draws it (pure).
//
// `mapProps(world, current)` gives exactly the widget's props (docs/v2/WIDGETS.md): nodes with an
// icon for their kind, edges for the routes, layers by plane or region, the scene's place as
// `current`, the places the story has reached as `discovered` (pack places it has not are under
// the fog), and a legend of the kinds on show. The screen adds `onSelect`, `fog` and `label`.
//
// `atlasView(world, current, options)` is the data of the atlas's own Map widget (widget.js):
// every place the reader may know of, visited or not (a pack's hidden or secret place only once
// the story has been there), the routes between them, the regions and planes that have places,
// and which way north and east run.
// Public face: re-exports its parts.

export { DEFAULT_ICON, iconFor } from './map-parts/icons.js';
export { layerOf, mapProps } from './map-parts/props.js';
export { atlasView, viewLayerOf } from './map-parts/view.js';
