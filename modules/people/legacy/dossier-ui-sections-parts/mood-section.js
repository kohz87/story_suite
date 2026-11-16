/* NPC State Delta dossier sections part: the Mood section: the mood word, its meter rows, Recent changes and the Pull. */
import { escapeHtml } from '../../util/html.js';
import { changeStamp, wholeNumber } from '../dossier-ui-model.js';
import { changeRowHtml, NO_REASON } from '../dossier-ui-relationship.js';
import { MOOD_AXES, moodDescriptors, moodTile, possessiveWord, pullTile } from '../dossier-ui-view-model.js';
import { moodRowsHtml, pullRowHtml, signedText } from '../dossier-ui-board.js';
import { subhead, updatedLineHtml } from './shared-section-bits.js';

// The fields each of the two sections tells about, in the words the line "Updated this reply" uses.
const MOOD_FIELD_WORDS = Object.freeze({ mood: 'mood' });

// "Recent changes" under the mood rows: the last three moves of Feeling / Energy / Control (date and reply on the left, the changes over their reason on the
// right, the With {{user}} list's own row); when the reply on show moved nothing the list starts with a "no change" row (it counts in the three).
const RECENT_MOOD = 3;
// True when the stored field changes say the reply on show changed the mood (a reply read can write the mood word without a history row).
function moodChangedAt(npc, reply) {
    const changes = npc.fieldChanges;
    if (!changes || changes.latestTurn === null || !(changes.latest || []).includes('mood')) return false;
    const stamp = changeStamp({ turn: changes.latestTurn, message: changes.message });
    return !stamp.legacy && stamp.message !== null && stamp.message === wholeNumber(reply);
}
function moodHistoryHtml(npc, mood, reply) {
    const title = subhead('Recent changes');
    if (!mood.known) return `<div class="delta-sheet-recent">${title}<p class="delta-muted">No mood change recorded yet.</p></div>`;
    const now = wholeNumber(reply);
    const mark = number => (Number.isInteger(number) ? `<small>#${number}</small>` : '');
    const quiet = mood.quiet && !moodChangedAt(npc, reply) ? [changeRowHtml(`<span class="delta-chg-when">${mark(now)}</span>`, `<span class="delta-chg-d" data-good="muted">${mood.atRest ? 'no mood change this reply' : `no change \u00b7 fading toward ${escapeHtml(possessiveWord(npc.gender, { lower: true }))} calm`}</span>`, [])] : [];
    const moves = mood.log.map(row => {
        const heads = MOOD_AXES.filter(([key]) => row[key]).map(([key, label]) => `<span class="delta-chg-d" data-good="${row[key] > 0 ? 'yes' : 'no'}">${escapeHtml(label)} ${escapeHtml(signedText(row[key]))}</span>`).join(' \u00b7 ');
        return changeRowHtml(`<span class="delta-chg-when">${[row.date ? escapeHtml(row.date) : '', mark(row.n)].filter(Boolean).join('<br>')}</span>`, heads, [row.why || NO_REASON]);
    });
    // A chat from before the history existed has only the last cause (no numbers, date or reply were kept): it is never a row of its own;
    // it joins the text of the oldest row on show, or stands as one muted line when there is no row.
    const rows = [...quiet, ...moves];
    const cause = !mood.log.length && mood.cause ? mood.cause : '';
    if (cause && rows.length) rows[rows.length - 1] = rows[rows.length - 1].replace(/<\/div><\/li>$/, `<div class="delta-chg-via">Earlier: ${escapeHtml(cause)}</div></div></li>`);
    const earlier = cause && !rows.length ? `<p class="delta-muted">Earlier: ${escapeHtml(cause)}</p>` : '';
    return `<div class="delta-sheet-recent">${title}${rows.length ? `<ul class="delta-list">${rows.slice(0, RECENT_MOOD).join('')}</ul>` : ''}${earlier}</div>`;
}

// Mood, as the mockup draws it: the mood word with its few plain words and three meter rows (Feeling, Energy, Control: the number on the
// -3..+3 scale and this reply's change, also at rest); "Recent changes" (the last three moves of the mood); the Pull as one line under its heading
// (marked New on its first day); then the line that says whether the latest reply updated the mood.
export function moodSectionHtml(npc = {}, { reply = null } = {}) {
    const mood = moodTile(npc, reply);
    const pull = pullTile(npc);
    const words = moodDescriptors(mood);
    return '<div class="delta-sheet delta-now">'
        + `<dl class="delta-kv"><dt>Mood</dt><dd><b>${escapeHtml(mood.text)}</b>${words.length ? ` · ${escapeHtml(words.join(', '))}` : ''}</dd></dl>`
        + moodRowsHtml(mood)
        + moodHistoryHtml(npc, mood, reply)
        + (pull ? subhead('Pull') + pullRowHtml(pull) : '')
        + updatedLineHtml(npc, reply, MOOD_FIELD_WORDS)
        + '</div>';
}
