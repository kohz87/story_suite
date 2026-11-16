// Story Director v2, part **cast**: formatting pack display names.

/** A pack's name without a trailing parenthetical, as NPC State Delta writes it: "Ersveil (open world)" is "Ersveil". */
export const shortName = name => String(name ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim() || String(name ?? '').trim();

/** The name a pack goes by in words ("Ersveil"): its listed name, else its id. */
export const packName = (cast, pack) => cast?.packs?.[pack]?.name || pack;
