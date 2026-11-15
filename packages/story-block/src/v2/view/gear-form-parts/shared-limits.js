// Gear form: the shared limits (kinds, name and note length) and the "only while Kind is Equipment" condition.

/** The kinds the form offers, in the inventory's own words. */
export const FORM_KINDS = Object.freeze(['equipment', 'consumable', 'goods', 'quest', 'material']);
export const NAME_MAX = 60;
export const NOTE_MAX = 300;
export const SHOWN = Object.freeze({ key: 'kind', in: Object.freeze(['equipment']) });
