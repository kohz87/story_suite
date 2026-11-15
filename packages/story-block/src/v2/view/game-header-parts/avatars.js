// The avatar paths on the server and the order in which the hero tries a lead's pictures.

import { textOf } from './shared-reads.js';

/** A SillyTavern avatar file as the path it is served on ('' for none). */
export function personaAvatarUrl(file) {
    const name = textOf(file);
    return name ? `/thumbnail?type=persona&file=${encodeURIComponent(name)}` : '';
}

export function cardAvatarUrl(file) {
    const name = textOf(file);
    return name ? `/thumbnail?type=avatar&file=${encodeURIComponent(name)}` : '';
}
/**
 * The pictures for the lead in the order to try them: the persona avatar, the card avatar, the module's picture (`npcPicture`,
 * already a string: see pictureOf). Empty ones are left out; the hero tries them in turn and draws the initial past the last.
 */
export function portraitCandidates({ personaFile = '', cardFile = '', npcPicture = '' } = {}) {
    return [personaAvatarUrl(personaFile), cardAvatarUrl(cardFile), textOf(npcPicture)].filter(Boolean);
}

/** The first of portraitCandidates: '' when there is none. */
export function portraitOf(args = {}) {
    return portraitCandidates(args)[0] ?? '';
}
