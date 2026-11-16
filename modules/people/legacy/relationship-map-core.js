/* NPC State Delta relationship map primitives: pure layout, selection and bond rules over the
   dossier projection. No DOM, host or state access. Public face: re-exports its parts. */
export { MAP_SPAN, MAP_CENTER, DESKTOP_NODE_CAP, PHONE_NODE_CAP } from './relationship-map-core-parts/span-and-caps.js';
export { MAP_CIRCLE_MIN, MAP_CARD_MIN, MAP_ROOM, MAP_CARD_BESIDE_MIN } from './relationship-map-core-parts/layout-breakpoints.js';
export { MAP_LABELS_SHORT_MAX, MAP_NAMES_MIN, MAP_DENSE_NODES } from './relationship-map-core-parts/label-breakpoints.js';
export { MAP_LENSES, RELATIONSHIP_MAP_DEFAULTS, normalizeRelationshipMapSettings, lensValue } from './relationship-map-core-parts/lenses.js';
export { plain, signed } from './relationship-map-core-parts/shared-values.js';
export { mapRadius, mapAngles } from './relationship-map-core-parts/geometry.js';
export { mapStatus, selectMapNpcs, resolveMapBonds } from './relationship-map-core-parts/selection.js';
export { relationshipDelta, buildMapModel } from './relationship-map-core-parts/model.js';
export { WORD_SIZE, nodeBoxes, ringWordSpot } from './relationship-map-core-parts/ring-word.js';
