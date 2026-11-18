// What a pack is for: the tag the Packs list shows under a pack's name, from the kind it states (format 4: "world" or "game").

const TAGS = Object.freeze({ world: 'World pack', game: 'Game pack' });

/** The plain tag of a pack: "World pack" or "Game pack", or "Pack" for anything that states neither. */
export function packTag(pack) {
    return TAGS[pack?.kind] ?? 'Pack';
}
