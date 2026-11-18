// The markup for the now lines, with empty text slots, and the attribute that ties them to their model.
import { escapeAttr } from './shared-text.js';

const slotHtml = (tag, className, index) => `<${tag} class="${className}" data-delta-text="${Number(index)}"></${tag}>`;

/**
 * The empty now lines for a card (filled by fillPresentSceneText), or ''. Each line is its label
 * plus a text slot; the line's tooltip slot receives the full text.
 */
export function nowSlotHtml(model, id) {
    const now = model?.now?.[id];
    if (!now?.parts?.length) return '';
    const lines = now.parts.map(part => `<span class="npc-state-delta-present-now-part npc-state-delta-present-now-${escapeAttr(part.key)}" data-delta-title="${Number(part.title)}"><span class="npc-state-delta-present-now-label">${escapeAttr(part.label)}:</span> ${slotHtml('span', 'npc-state-delta-present-now-text', part.text)}</span>`).join('');
    return `<span class="npc-state-delta-present-now">${lines}</span>`;
}

/** The roster attribute that ties rendered slots to their model. */
export function sceneAttr(model) {
    return model?.signature ? ` data-delta-scene="${escapeAttr(model.signature)}"` : '';
}
