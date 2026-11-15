// Story Director v2, chronicle part: scene and block receipt type sets. Pure.

// Story Block's scene receipts that name who came into the scene (`data.added`).
export const PRESENT_TYPES = new Set(['capture.present', 'scene.present']);
// Every Story Block receipt that carries the whole present list after it: a place move empties the scene but for who `with:` brings along.
export const SCENE_TYPES = new Set([...PRESENT_TYPES, 'capture.place', 'scene.place']);
export const DM_TYPES = new Set(['capture.dm', 'dm.act']);
export const PRESENCE_TEXT = /\b(?:is|is not) here\.?$/i;
