/* NPC State Delta dossier surface: plain-value coercion helpers shared by every dossier module. */

function plain(value, fallback = '') {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    return text || fallback;
}

function stringList(value, limit = 12) {
    return (Array.isArray(value) ? value : [])
        .map(item => plain(item))
        .filter(Boolean)
        .slice(0, limit);
}

function relationshipValue(value) {
    return Math.max(-100, Math.min(100, Math.round(Number(value) || 0)));
}

function wholeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : null;
}

export { plain, stringList, relationshipValue, wholeNumber };
