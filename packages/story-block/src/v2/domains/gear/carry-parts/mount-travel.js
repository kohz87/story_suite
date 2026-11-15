// Whether a mount row travels with the party, from its `where` text and the party's place.

// "ridden by Wessel", "led by Tam": with the party; "stabled at the Stray Oar": where it was left.
const WITH_PARTY = /^\s*(?:ridden|rode|rides|riding|led|leads|leading|pulled|pulling|hitched|loaded|carried|carrying|with|travel)/i;
const foldWords = text => String(text ?? '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** Does a mount row travel with the party? Its `where` is empty, names the party's place, or says it is ridden, led or pulled. */
export function travelsWith(where, place) {
    const said = foldWords(where);
    if (!said || WITH_PARTY.test(String(where))) return true;
    const here = foldWords(place);
    return Boolean(here) && (said.includes(here) || here.includes(said));
}
