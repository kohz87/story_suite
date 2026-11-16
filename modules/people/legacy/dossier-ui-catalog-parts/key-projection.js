/* NPC State Delta dossier surface: the key-person (while away) projection and its section markup. */
import { escapeHtml } from '../../util/html.js';
import { awayRange } from '../../cast/key-people.js';
import { plain } from '../dossier-ui-model.js';

// (key people) What the dossier shows of Story Director's key-person data for one dossier: { here, away, recent }, with the
// absence as { doing, since, back, steps: [{ date, text }], range } and `recent` the last absence of someone who has come back
// ({ away, justReturned }); null for anyone who is not a key person. Text only: the view draws it escaped.
function awayProjection(away) {
    if (!away || typeof away !== 'object') return null;
    const record = {
        doing: plain(away.doing), since: plain(away.since), back: plain(away.back),
        steps: (Array.isArray(away.steps) ? away.steps : []).slice(-12)
            .map(step => ({ date: plain(step?.date), text: plain(step?.text) })).filter(step => step.text),
    };
    return { ...record, range: awayRange(record) };
}
export function keyProjection(view) {
    if (!view || typeof view !== 'object') return null;
    const away = awayProjection(view.away);
    const recentAway = view.recent && typeof view.recent === 'object' ? awayProjection(view.recent.away) : null;
    return { here: view.here === true, away, recent: recentAway ? { away: recentAway, justReturned: view.recent.justReturned === true } : null };
}

/** The "While away" section: the dates and the steps while a key person is away, and after the return for a few replies. */
export function keyAwayHtml(key) {
    const shown = key?.away ?? key?.recent?.away ?? null;
    if (!shown) return '';
    const now = Boolean(key.away);
    const steps = shown.steps.map(step => `<li>${step.date ? `<b>${escapeHtml(step.date)}</b>: ` : ''}${escapeHtml(step.text)}</li>`).join('');
    const note = now
        ? 'Their meters and stable profile are held while they are away. The narrator gets this summary with their dossier when they return.'
        : 'They are back. Their meters and stable profile did not change while they were away.';
    return `<section class="delta-away" data-delta-section="away" aria-label="While away">
        <h5>While away${shown.range ? ` · ${escapeHtml(shown.range)}` : ''} <span class="delta-muted">(from Story Director)</span></h5>
        ${shown.doing ? `<p class="delta-away-doing">${escapeHtml(shown.doing)}</p>` : ''}
        ${steps ? `<ol>${steps}</ol>` : ''}
        <p class="delta-muted delta-away-note">${note}</p>
    </section>`;
}
