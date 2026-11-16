// Naming the water: which of river, lake or sea a place's words describe, and the spot made from it.

const WATER_WORDS = Object.freeze({
    sea: /\b(?:sea|seas|ocean|coast|coastal|shore|beach|harbou?r|bay|port|pier|cove|strand|reef|gulf|wharf|docks?)\b/i,
    lake: /\b(?:lake|lakes|lakeside|mere|loch|lough|pond|pool|tarn|reservoir|lagoon)\b/i,
    river: /\b(?:river|riverside|riverbank|stream|brook|creek|burn|beck|ford|falls|weir|rapids|canal|rill)\b/i,
});

/** 'river' | 'lake' | 'sea' named by the words of a place, or null. Sea words win over lake over river. */
export function waterOf(...texts) {
    const text = texts.filter(t => typeof t === 'string').join(' ');
    for (const kind of ['sea', 'lake', 'river']) if (WATER_WORDS[kind].test(text)) return kind;
    return null;
}

/** A spot { name, kind } from a scene place ({ name, kind, region }), or null when no water is named. */
export function spotFromPlace(place) {
    if (!place || typeof place !== 'object') return null;
    const name = String(place.name ?? '').trim();
    const kind = waterOf(place.name, place.kind, place.region);
    if (!kind) return null;
    return { name: name || `the ${kind}`, kind };
}

/** The spot's display name when the reader picks the water by hand: "the lake by Bluewatch Village". */
export function pickedSpotName(kind, placeName = '') {
    const place = String(placeName ?? '').trim();
    return place ? `the ${kind} by ${place}` : `the ${kind}`;
}
