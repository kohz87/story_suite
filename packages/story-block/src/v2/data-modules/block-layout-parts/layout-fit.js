// Which of the three layouts fit the draft's fields, which one to suggest and why.
import { fill, STRINGS } from '../../strings.js';
import { entriesOf } from './shared-entries.js';

const B = STRINGS.blocks;
export const LAYOUTS = Object.freeze(['cards', 'bars', 'fields']);
export const TONES = Object.freeze(['active', 'done', 'failed', 'neutral']);

const list = names => (names.length > 3 ? `${names.slice(0, 3).join(', ')}, …` : names.join(', '));

/**
 * → { fits: { cards, bars, fields }: { ok, reason }, suggested: 'cards'|'bars'|'fields'|null, why }. A layout that does not fit says why in `reason`.
 * The suggestion: a List of entries with a text part → cards; every field a number → bars; anything else → fields.
 */
export function layoutShape(draft) {
    const fields = Array.isArray(draft?.fields) ? draft.fields : [];
    const lists = entriesOf(draft), titled = lists.filter(field => (field.of ?? []).some(part => part.type === 'text'));
    const others = fields.filter(field => field.type !== 'number');
    const empty = !fields.length;
    const fits = {
        cards: titled.length ? { ok: true, reason: '' } : { ok: false, reason: empty ? B.layoutEmpty : lists.length ? B.layoutCardsTitle : B.layoutCardsNeed },
        bars: !empty && !others.length ? { ok: true, reason: '' } : { ok: false, reason: empty ? B.layoutEmpty : fill(B.layoutBarsNot, { names: list(others.map(field => field.name || field.key)) }) },
        fields: empty ? { ok: false, reason: B.layoutEmpty } : { ok: true, reason: '' },
    };
    const suggested = empty ? null : fits.cards.ok ? 'cards' : fits.bars.ok ? 'bars' : 'fields';
    const why = !suggested ? B.layoutEmpty : suggested === 'cards' ? fill(B.whyCards, { name: titled[0].name || titled[0].key })
        : suggested === 'bars' ? fill(B.whyBars, { n: fields.length }) : fill(B.whyFields, { n: fields.length });
    return { fits, suggested, why };
}
