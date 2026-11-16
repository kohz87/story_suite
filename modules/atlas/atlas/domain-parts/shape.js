// Atlas core ID patterns, name length limit, and initial state shape.

export const PLACE_ID = /^pl_[0-9a-z]{8}$/;
export const ROUTE_ID = /^rt_[0-9a-z]{8}$/;
export const MAX_NAME = 80;

export function initialAtlas() {
    return { places: {}, routes: {}, keys: {}, focus: null, regions: {}, placeRegions: {}, placeRefs: {}, danger: { world: null, regions: {}, places: {} }, writes: {} };
}
