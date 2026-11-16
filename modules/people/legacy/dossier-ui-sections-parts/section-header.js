/* NPC State Delta dossier sections part: the section ids, their titles, the step between them and the header every section shares. */
import { escapeHtml } from '../src/util/html.js';
import { plain } from '../dossier-ui-model.js';
import { SECTION_KEYS } from '../dossier-ui-screens.js';

// The six sections in the order the arrows, a sideways swipe and the dots walk them.
export const SECTION_IDS = SECTION_KEYS;

// The heading of one section. "With" takes the persona's name in each chat (the mockup's "With {{user}}").
export function sectionTitle(id, userName = '') {
    const who = plain(userName);
    if (id === 'mood') return 'Mood';
    if (id === 'now') return 'Right now';
    if (id === 'with') return who ? `With ${who}` : 'With you';
    if (id === 'ties') return 'Ties';
    if (id === 'past') return 'Past';
    if (id === 'secrets') return 'Secrets';
    return '';
}

// The section one step away (-1 back, 1 forward), or null at either end or for an unknown id.
export function sectionStep(id, step) {
    const at = SECTION_IDS.indexOf(id);
    if (at < 0) return null;
    return SECTION_IDS[at + Math.sign(Number(step) || 0)] ?? null;
}

// The header every section shares: ‹ and › (disabled at the ends), the title, "Name · N of 6" and one dot per section.
// The arrows carry data-delta-section-step="-1|1" and the dots data-delta-section-go="<id>" for the screens' handler.
export function sectionHeaderHtml(id, { npcName = '', userName = '' } = {}) {
    const at = SECTION_IDS.indexOf(id);
    if (at < 0) return '';
    const prev = sectionStep(id, -1);
    const next = sectionStep(id, 1);
    const who = plain(npcName);
    const dots = SECTION_IDS.map((other, index) => {
        const current = index === at;
        return `<button type="button" class="delta-section-dot${current ? ' on' : ''}" data-delta-section-go="${escapeHtml(other)}" aria-label="${escapeHtml(sectionTitle(other, userName))}"${current ? ' aria-current="step"' : ''}></button>`;
    }).join('');
    return `<button type="button" class="delta-section-back" data-delta-screen="board" aria-label="Back to the dossier">‹ Dossier</button>
    <header class="delta-section-head" data-delta-section-head="${escapeHtml(id)}">
        <button type="button" class="delta-section-arrow" data-delta-section-step="-1" aria-label="Previous section"${prev ? '' : ' disabled'}>‹</button>
        <div class="delta-section-title">
            <b>${escapeHtml(sectionTitle(id, userName))}</b>
            <span>${who ? `${escapeHtml(who)} · ` : ''}${at + 1} of ${SECTION_IDS.length}</span>
            <div class="delta-section-dots">${dots}</div>
        </div>
        <button type="button" class="delta-section-arrow" data-delta-section-step="1" aria-label="Next section"${next ? '' : ' disabled'}>›</button>
    </header>`;
}
