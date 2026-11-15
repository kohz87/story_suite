// Layer constants and predicates for filtering places by map layer.

export const ALL = '';

/** Whether a place shows on a layer: "All" shows every place off the planes; a layer its own places. */
export const onLayer = (place, layer) => (layer === ALL ? !place.plane : place.layer === layer);

/** The layer a place is found on: its own when it has one and the reader is not on "All", else "All". */
export const layerFor = (place, layer) => (place.plane ? place.layer : layer === ALL || !place.layer ? ALL : place.layer);
