// Who a mount row's `where` names: its riders ("ridden by Wessel and Tam", or a bare list of party members) and whether it names a party member at all.

const RIDDEN = /^\s*(?:ridden|rode|rides|riding|led|leads|leading|pulled|pulling|driven|driving)\s+by\s+(.+?)\s*$/i;
// A title is not a first name: "Sister Temiwa" is also called "Temiwa", never "Sister".
const TITLES = new Set(['sister', 'brother', 'father', 'mother', 'sir', 'dame', 'lady', 'lord', 'captain', 'corporal', 'sergeant', 'lieutenant', 'master', 'mistress', 'old', 'young', 'the', 'doctor', 'dr', 'mr', 'mrs', 'ms', 'miss']);

// How a name is written: one to four words, each with a capital first ("Vessa", "Corporal Stenn").
const NAME_LIKE = /^\p{Lu}[\p{L}\p{M}'’.-]*(?:\s+\p{Lu}[\p{L}\p{M}'’.-]*){0,3}$/u;

const words = text => String(text ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
const listed = text => String(text ?? '').split(/\s*(?:,|&|\band\b)\s*/i).map(name => name.trim()).filter(Boolean);
// The ways a member is called: the full name, then the first name (the first word that is no title).
const calls = name => {
    const full = words(name);
    const first = full.split(' ').find(word => !TITLES.has(word));
    return [full, first].filter(call => call && call.length > 1);
};
// The member a written name means (a full name wins over a first name), or null.
const memberFor = (said, party) => {
    const key = words(said);
    return party.find(name => words(name) === key) ?? party.find(name => calls(name).includes(key)) ?? null;
};

/**
 * The names a `where` gives (in order, no repeats); [] when it names nobody. "ridden by Wessel, Tam and Mara" gives them as written. A bare list
 * of names ("Rav, Torka, Vessa") gives the members of `party` (the party's names) in it, each as the party calls them; the others are left out.
 * Text with any part that is neither a member nor written as a name ("stabled at the inn, Torka") is no bare list.
 */
export function ridersOf(where, party = []) {
    const match = RIDDEN.exec(String(where ?? ''));
    if (match) return [...new Set(listed(match[1]))];
    const found = listed(where).map(said => ({ said, member: memberFor(said, party) }));
    if (!found.every(({ said, member }) => member || NAME_LIKE.test(said))) return [];
    return [...new Set(found.map(({ member }) => member).filter(Boolean))];
}

/** Does `where` name one of `party`, by full name or first name, as whole words? */
export function namesMember(where, party = []) {
    const said = ` ${words(where)} `;
    return party.some(name => calls(name).some(call => said.includes(` ${call} `)));
}
