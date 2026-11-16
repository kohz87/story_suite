/* NPC State Delta dossier surface: the Board tiles, in mockup order, from the board model. */
import { gateWords } from '../dossier-ui-view-model.js';
import { NO_REASON } from '../dossier-ui-relationship.js';
import { signed } from './shared-markup.js';
import { moodRowsHtml, pullRowHtml } from './meter-rows.js';

// The tiles, in mockup order, from the boardModel tiles object. The Pull rides inside the Mood tile (nothing when there is no pull).
// `userName` replaces the literal "{{user}}" in the With {{user}} title.
export function boardTiles(model = {}, { userName = 'you', facesHtml = '' } = {}) {
    const tiles = model.tiles || {};
    const last = tiles.lastChange || {};
    const moved = Array.isArray(last.moved) ? last.moved : [];
    const secrets = tiles.secrets || {};
    const now = tiles.rightNow || {};
    const ties = tiles.ties || {};
    const past = tiles.past || {};
    const next = String(secrets.next || '').replace(/^opens\s*/i, '');
    const sets = [
        {
            title: `${(last.title || 'With {{user}}').replace('{{user}}', userName)} · ${last.heading || 'Last change'}`,
            section: 'with',
            wide: true,
            // tension rising reads as bad, the other axes falling too (the same rule as the Recent changes list)
            tone: moved.some(item => (item.axis === 'tension' ? item.value > 0 : item.value < 0)) ? 'bad' : (moved.length ? 'good' : ''),
            lead: moved.length ? moved.map(item => `${item.label} ${signed(item.value)}`).join(' · ') : '',
            big: moved.length ? '' : (last.hasChange ? '' : 'No change yet'),
            lines: [gateWords(last.gate), last.reason || (last.hasChange && !gateWords(last.gate) ? NO_REASON : '')],
        },
        {
            // The Mood tile opens the Mood section and carries the Pull as its one footer line (no separate Pull card).
            title: tiles.mood?.title || 'Mood', section: 'mood', wide: true, tone: 'ten', big: tiles.mood?.text || 'Unknown', bigClass: 'delta-tile-mood',
            rowsHtml: moodRowsHtml(tiles.mood), footHtml: pullRowHtml(tiles.pull, { label: true }),
        },
        {
            // The place joins the title when the body is what she is doing, as the mockup reads: RIGHT NOW · NORTHERN RIDGE.
            title: `${now.title || 'Right now'}${now.doing && now.place ? ` · ${now.place}` : ''}`,
            section: 'now',
            tone: 'ten',
            wide: true,
            lines: [now.summary || 'Nothing recorded yet'],
        },
        {
            title: ties.title || 'Ties',
            section: 'ties',
            tone: 'aff',
            faces: facesHtml,
            small: true,
            lines: [ties.count ? `${ties.count} · ${(ties.names || []).join(', ')}` : 'None established yet'],
        },
        {
            title: `${past.title || 'Past'}${past.count ? ` · ${past.count}` : ''}`,
            section: 'past',
            tone: 'des',
            small: true,
            dots: past.dots,
            lines: [past.latest || 'Nothing remembered yet'],
        },
        {
            title: secrets.title || 'Secrets',
            section: 'secrets',
            tone: 'held',
            wide: true,
            ring: { value: secrets.total ? (secrets.open / secrets.total) * 100 : 0, text: `${secrets.open ?? 0}/${secrets.total ?? 0}` },
            note: [secrets.lastOpen ? `${secrets.lastOpen} opened` : '', next ? `the next opens ${next}` : (secrets.total ? (secrets.open === secrets.total ? 'all open' : '') : 'None yet')].filter(Boolean).join(' · '),
        },
    ];
    return sets.filter(Boolean);
}
