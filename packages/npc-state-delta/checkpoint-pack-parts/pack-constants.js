/* NPC State Delta pack format constants and the PackError type for checkpoint packing. */

export const PACK_SCHEME = 'chain-rfc6902';
export const PACK_DEFAULTS = Object.freeze({ anchorEvery: 25, fullTail: 4, maxChainEntries: 80 });

export class PackError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PackError';
    }
}
