// Field names of the places and routes a pack gives the atlas.

// Map data for Story Director's atlas (coordinates in map units, distances in km).
// `hidden: true` (or its alias `secret: true`): the map keeps the place off until the story goes there.
// `market` and `tags` (PACKS.md "Markets"): the place's settlement type ('village', 'city') and environment
// tags ('river', 'port') that set its prices.
export const PLACE_FIELDS = Object.freeze(['name', 'slug', 'aliases', 'region', 'kind', 'layer', 'x', 'y', 'note', 'hidden', 'secret', 'market', 'tags', 'loot']);
export const ROUTE_FIELDS = Object.freeze(['slug', 'from', 'to', 'kind', 'km', 'hours', 'corridor', 'note']);
