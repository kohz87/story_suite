/* NPC State Delta dossier surface: the portrait image or its initials placeholder. */
import { escapeHtml } from '../src/util/html.js';
import { plain } from '../dossier-ui-model.js';
import { imageSourceAttribute } from './portrait-refs.js';

// Up to two initials: the first letters of the first two words ("The inspector" reads "TI", "Marrit" reads "M").
export const initialsOf = name => String(name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(word => [...word][0].toUpperCase()).join('');

function portraitHtml(npc, className, { alt = true, refs = null } = {}) {
    const src = plain(npc?.portrait);
    if (src) return `<img class="${className}" ${imageSourceAttribute(src, refs)} alt="${alt ? `${escapeHtml(npc?.name || 'NPC')} portrait` : ''}" loading="lazy" decoding="async">`;
    const initial = escapeHtml(initialsOf(npc?.name) || '?');
    return `<div class="${className} delta-portrait-placeholder" aria-hidden="true"><span>${initial}</span></div>`;
}

export { portraitHtml };
