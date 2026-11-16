// Folds text and scores places for map search.

/** Text as search compares it: accents and case gone, apostrophes dropped, other marks a space. */
export const fold = text => String(text ?? '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase()
    .replace(/['’‘`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// At most one letter wrong, missing or extra (for words of four letters or more).
function nearWord(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i += 1; j += 1; continue; }
        edits += 1;
        if (edits > 1) return false;
        if (a.length > b.length) i += 1;
        else if (b.length > a.length) j += 1;
        else { i += 1; j += 1; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
}

// How well one folded query matches one folded text: 0 when it does not.
function scoreText(query, text) {
    if (!text) return 0;
    if (text === query) return 100;
    if (text.startsWith(query)) return 90;
    const words = text.split(' ');
    if (words.some(word => word.startsWith(query))) return 80;
    if (text.includes(query)) return 70;
    // Every query word starts a word of the text (in any order), or nearly matches one.
    const asked = query.split(' ');
    if (asked.every(part => words.some(word => word.startsWith(part)))) return 60;
    if (asked.every(part => words.some(word => word.startsWith(part) || (part.length >= 4 && nearWord(part, word.slice(0, part.length + 1)) || (part.length >= 4 && nearWord(part, word)))))) return 40;
    return 0;
}

/**
 * Places matching `text` by name, alias or region, best first: `[{ id, score, by }]` (`by`: 'name',
 * 'alias' or 'region'). Case, accents and one wrong letter in a longer word don't matter. Ties go
 * to visited places, then by name. `places`: `[{ id, name, aliases, region, visited }]`.
 */
export function searchPlaces(places, text, { limit = 8 } = {}) {
    const query = fold(text);
    if (!query) return [];
    const hits = [];
    for (const place of places) {
        const byName = scoreText(query, fold(place.name));
        const byAlias = Math.max(0, ...(place.aliases ?? []).map(alias => scoreText(query, fold(alias)))) * 0.9;
        // A region counts from the start of one of its words ("shorn" finds Shornmarch's places,
        // "watch" does not find every place in Bluewatch Village).
        const regionScore = scoreText(query, fold(place.region));
        const byRegion = (regionScore >= 80 || regionScore === 60 ? regionScore : 0) * 0.5;
        const score = Math.max(byName, byAlias, byRegion);
        if (score <= 0) continue;
        hits.push({ id: place.id, name: place.name, visited: Boolean(place.visited), score: Math.round(score), by: score === byName ? 'name' : score === byAlias ? 'alias' : 'region' });
    }
    hits.sort((a, b) => b.score - a.score || Number(b.visited) - Number(a.visited) || fold(a.name).localeCompare(fold(b.name)) || (a.id < b.id ? -1 : 1));
    return hits.slice(0, limit).map(({ id, score, by }) => ({ id, score, by }));
}
