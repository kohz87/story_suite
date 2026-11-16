/* NPC State Delta dossier surface: the living-cast projection and its "From the cast" block markup. */
import { escapeHtml } from '../../util/html.js';
import { plain } from '../dossier-ui-model.js';

// (the living cast) What the dossier shows for a person Delta made from the pack's cast: { badge, packName, firstMet, goal, routine,
// lastHeard: { text, on } | null, where, doing }; null for any other dossier. Text only: the view draws it escaped.
export function castProjection(view) {
    if (!view || typeof view !== 'object') return null;
    const heard = view.lastHeard && typeof view.lastHeard === 'object' && plain(view.lastHeard.text)
        ? { text: plain(view.lastHeard.text), on: plain(view.lastHeard.on) } : null;
    return {
        badge: plain(view.badge, 'Cast'), packName: plain(view.packName), firstMet: plain(view.firstMet),
        goal: plain(view.goal), routine: plain(view.routine), lastHeard: heard, where: plain(view.where), doing: plain(view.doing),
    };
}

/** The "From the Ersveil cast" block: where the person came from, their own path and when they were last heard of. */
export function castFromHtml(cast) {
    if (!cast) return '';
    const heard = cast.lastHeard ? `<b>Last heard:</b> ${escapeHtml(cast.lastHeard.text)}${cast.lastHeard.on ? ` (${escapeHtml(cast.lastHeard.on)})` : ''}` : '';
    const now = !cast.lastHeard && (cast.doing || cast.where)
        ? `<b>Now:</b> ${escapeHtml([cast.doing.replace(/[.\s]+$/, ''), cast.where ? `at ${cast.where}` : ''].filter(Boolean).join(' · '))}` : '';
    const path = cast.goal ? `<b>Their own path:</b> ${escapeHtml(cast.goal)}${cast.routine ? ` <span class="delta-muted">(${escapeHtml(cast.routine)})</span>` : ''}` : '';
    const lines = [path, heard || now].filter(Boolean).map(line => `<div>${line}</div>`).join('');
    return `<section class="delta-cast-from" data-delta-section="cast" aria-label="From the cast">
        <h5>From the ${cast.packName ? `${escapeHtml(cast.packName)} ` : ''}cast${cast.firstMet ? ` · first met ${escapeHtml(cast.firstMet)}` : ''}</h5>
        <div>Made at the first meeting from the pack's prepared dossier, no scan needed. Later scans add to it and change it as they do for anyone.</div>
        ${lines}
    </section>`;
}
