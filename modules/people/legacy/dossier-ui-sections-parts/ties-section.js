/* NPC State Delta dossier sections part: the Ties section: each tie stacked by type, with the older ties folded away. */
import { escapeHtml } from '../src/util/html.js';
import { plain } from '../dossier-ui-model.js';
import { parseKeyRelationshipEntry } from '../social-bonds.js';
import { noteTieTags, readTieRows, TIE_TYPE_LABELS } from '../core-keyrel.js';

// One tie, stacked: its type (Ally, Rival, Owes, Interest, Passing: small heading, toned), the other person, and the description (the
// relation as written, then the dynamic). Older ties add why they are there (died, left, not mentioned for N days). Own divider each.
const TIE_TONES = { kin: 'good', partner: 'good', friend: 'good', ally: 'good', mentor: 'good', serves: 'gold', rival: 'bad', enemy: 'bad', owes: 'gold', interest: 'rose', passing: 'grey' };
function tieHtml(row) {
    const parsed = parseKeyRelationshipEntry(row.entry);
    if (!parsed) return `<div class="delta-bond" data-tone="grey"><p>${escapeHtml(plain(row.entry))}</p></div>`;
    // The relation as written goes into the description (not repeated when it is just the type word).
    const description = [String(parsed.relation).toLowerCase() === row.type ? '' : parsed.relation, parsed.dynamic].map(value => plain(value)).filter(Boolean).join(' — ');
    const why = row.state === 'died' ? ' · † died' : (row.state === 'left' ? ' · left' : '');
    const quiet = row.state === 'faded' && Number.isInteger(row.quiet) ? `${description ? ' · ' : ''}not mentioned for ${row.quiet} days` : '';
    return `<div class="delta-bond" data-tone="${TIE_TONES[row.type] ?? 'grey'}" data-tie-type="${escapeHtml(row.type)}"><span class="delta-bond-word">${escapeHtml(TIE_TYPE_LABELS[row.type] ?? 'Passing')}</span><b>${escapeHtml(parsed.subject)}${why ? `<span class="delta-bond-why">${why}</span>` : ''}</b>${description || quiet ? `<p>${escapeHtml(description)}${quiet}</p>` : ''}</div>`;
}

// Ties: the relationships only; lies told live in With {{user}} and what she knows about others in Secrets.
export function tiesSectionHtml(npc = {}) {
    const rows = Array.isArray(npc.tieRows) ? npc.tieRows : readTieRows(npc, { tags: noteTieTags(npc.v2Meters?.notes?.ties) });
    if (!rows.length) return '<p class="delta-muted">No important ties recorded yet.</p>';
    const current = rows.filter(row => row.state === 'active');
    const older = rows.filter(row => row.state !== 'active');
    // Older ties: not mentioned for their tier's days, the other person left, or died. Collapsed, last in the section.
    const fold = older.length ? `<details class="delta-older-ties"><summary>Older ties · ${older.length}</summary>${older.map(tieHtml).join('')}</details>` : '';
    return `<div class="delta-sheet delta-ties">${current.map(tieHtml).join('')}${fold}</div>`;
}
