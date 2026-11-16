// Matches names: the folded form, whether a party member is a Character, and which entry or skill a phrase names.
/** A name as the matcher compares it: NFKC, lower case, spaces and hyphens gone ("Iron-Breath" = "iron breath"). */
export const fold = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s\-‐‑–—]+/gu, '');

/**
 * Whether a party member called `name` (with `aliases`) is the Character `character` (readSheet's), among the Characters `characters` (the whole sheet):
 * the same name (case, spaces and hyphens do not count); else the first name against the whole one (Ren is Ren Ashby) or an alias of the member that is
 * either, but only when exactly one Character is meant that way and no Character is called that exactly ("Ren Ashby" and "Ren Holt" with a member "Ren"
 * are neither: it is not guessed). An exact name always wins over a first name.
 */
export function sameWho(character, name, aliases = [], characters = [character]) {
    const first = value => fold(String(value ?? '').trim().split(/\s+/u)[0]);
    const values = [name, ...(Array.isArray(aliases) ? aliases : [])].filter(value => typeof value === 'string' && value.trim());
    const exact = entry => values.some(value => fold(value) === entry?.key);
    const loose = entry => {
        const whole = String(entry?.who ?? entry?.key ?? '');
        return values.some(value => (!/\s/u.test(value.trim()) && fold(value) === first(whole)) || (!/\s/u.test(whole.trim()) && fold(whole) === first(value)));
    };
    if (exact(character)) return true;
    const all = Array.isArray(characters) && characters.includes(character) ? characters : [...(Array.isArray(characters) ? characters : []), character];
    if (all.some(exact)) return false;
    return loose(character) && all.filter(loose).length === 1;
}

/**
 * Which of `entries` a phrase names (SPEC_RPG_v1 §4.5.1): an entry whose folded name equals the folded phrase, else the
 * longest entry whose folded name occurs inside the phrase ("iron breath drill" → Iron Breath), and with `either` also
 * an entry whose name contains the phrase when it is the only one. Two different entries of the same longest length are
 * ambiguous and nothing matches. → the entry, or null.
 */
export function matchName(entries, phrase, name, { either = false } = {}) {
    const wanted = fold(phrase);
    if (!wanted) return null;
    const named = entries.map(entry => ({ entry, key: fold(name(entry)) })).filter(item => item.key);
    const exact = named.filter(item => item.key === wanted);
    if (exact.length) return exact.length === 1 ? exact[0].entry : null;
    const inside = named.filter(item => wanted.includes(item.key));
    if (inside.length) {
        const longest = Math.max(...inside.map(item => item.key.length));
        const top = inside.filter(item => item.key.length === longest);
        return top.length === 1 ? top[0].entry : null;
    }
    if (either) {
        const holds = named.filter(item => item.key.includes(wanted));
        if (holds.length === 1) return holds[0].entry;
    }
    return null;
}

/** The skill of `who`'s Skills block that a phrase names, or null. */
export const matchSkill = (character, phrase) => matchName(character?.skills ?? [], phrase, skill => skill.name);
