/* NPC State Delta dossier sections part: one whole section screen: the header, then the body of the section picked by its id. */
import { escapeHtml } from '../src/util/html.js';
import { sectionHeaderHtml, sectionTitle } from './section-header.js';
import { moodSectionHtml } from './mood-section.js';
import { nowSectionHtml } from './now-section.js';
import { withSectionHtml } from './with-section.js';
import { tiesSectionHtml } from './ties-section.js';
import { pastSectionHtml } from './past-section.js';
import { secretsSectionHtml } from './secrets-section.js';

const SECTION_BODIES = new Map([
    ['mood', moodSectionHtml],
    ['now', nowSectionHtml],
    ['with', withSectionHtml],
    ['ties', tiesSectionHtml],
    ['past', pastSectionHtml],
    ['secrets', secretsSectionHtml],
]);

// One whole section screen: its header with arrows and dots, then its body. Empty string for an unknown id.
export function sectionScreenHtml(id, npc = {}, { userName = '', reply = null } = {}) {
    const body = SECTION_BODIES.get(id);
    if (!body) return '';
    return `<section class="delta-section-screen" data-delta-section="${escapeHtml(id)}" aria-label="${escapeHtml(sectionTitle(id, userName))}">
        ${sectionHeaderHtml(id, { npcName: npc?.name, userName })}
        <div class="delta-section-body">${body(npc ?? {}, { reply })}</div>
    </section>`;
}
