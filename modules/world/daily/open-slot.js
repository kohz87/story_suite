// World events, open templates (spec §9): the slot's key (campaign seed + day + template id + place id), the batch size and the wait. Pure.

/** At most this many open slots of one step are answered by the Director (one batched call); the rest use their fallback. */
export const BATCH = 4;
/** A slot with no stored answer after this many world days uses its fallback. */
export const PENDING_DAYS = 3;

export const slotKey = (seed, day, template, place) => `${seed}|${day}|${template}|${place}`;
