// The badge and the cast block the dossier shows for a dossier made from the cast.

import { clip, isObject } from './shared-text.js';

/** The badge words: "Ersveil cast" (the pack's name) or "Cast". */
export const castBadge = castFrom => (castFrom?.packName ? `${castFrom.packName} cast` : 'Cast');

/**
 * What the dossier shows for a dossier made from the cast: { badge, packName, firstMet, goal, routine, lastHeard: { text, on } |
 * null, where, doing }. `person` is Story Director's answer for it (null without Story Director: then the starting words the
 * pack gave stand, and there is no "last heard"). Text only: the view draws it escaped. Null for any other dossier.
 */
export function castView(npc, person = null) {
    const from = npc?.castFrom;
    if (!isObject(from) || !from.key) return null;
    const start = person?.entry?.start;
    const where = from.met?.where ?? '';
    const on = from.met?.on ?? '';
    const firstMet = [on, where ? `${on ? 'at ' : ''}${where}` : ''].filter(Boolean).join(' ');
    return {
        badge: castBadge(from),
        packName: from.packName ?? '',
        firstMet,
        goal: clip(start?.goal || from.goal, 500),
        routine: clip(start?.routine || from.routine, 300),
        lastHeard: person?.lastHeard ?? null,
        where: person?.where ?? '',
        doing: person?.doing ?? '',
    };
}
