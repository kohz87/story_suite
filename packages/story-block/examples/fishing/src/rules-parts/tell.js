// Telling a fish in words: its weight, the article before it and the phrases that name it.

/** "640 g", "4.2 kg", "38 kg". */
export function formatWeight(grams) {
    if (grams < 1000) return `${grams} g`;
    const kg = grams / 1000;
    return kg >= 10 ? `${Math.round(kg)} kg` : `${(Math.round(kg * 10) / 10).toFixed(1)} kg`;
}

/** "a" or "an" for the word or number that follows. */
export function article(next) {
    return /^(?:[aeiou]|8|1[18](?!\d))/i.test(String(next)) ? 'an' : 'a';
}

/** "a rare 4.2 kg silver-violet trout" (a common fish leaves its rarity out). */
export function describeCatch(c) {
    const words = [c.rarity === 'common' ? '' : c.rarity, formatWeight(c.grams), c.name.toLowerCase()].filter(Boolean).join(' ');
    return `${article(words)} ${words}`;
}

/** "the 4.2 kg silver-violet trout" (for a fish already named). */
export function theCatch(c) {
    return `the ${formatWeight(c.grams)} ${c.name.toLowerCase()}`;
}
