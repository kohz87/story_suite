// The markup for the now lines, chatter bubbles and Others line, with empty text slots.
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
    return `<span class="${now.source === 'world-state' ? 'npc-state-delta-present-now npc-state-delta-present-now-world' : 'npc-state-delta-present-now'}">${lines}</span>`;
}

/** The bubbles beside one card: structure only, the text arrives through textContent. */
export function chatterSlotsHtml(model, id) {
    return bubblesHtml(model, model?.byCard?.[id]);
}

function bubblesHtml(model, lines) {
    if (!lines?.length) return '';
    const speech = model.kind === 'speech';
    const bubbles = lines.map(line => `<p class="npc-state-delta-bubble">${speech ? `<span class="npc-state-delta-bubble-order" aria-hidden="true">${Number(line.order)}</span>` : ''}${slotHtml('span', 'npc-state-delta-bubble-text', line.text)}</p>`).join('');
    return `<div class="npc-state-delta-chatter ${speech ? 'npc-state-delta-chatter-speech' : 'npc-state-delta-chatter-thought'}" aria-label="${speech ? 'Whispered' : 'Thinking'}">${bubbles}</div>`;
}

/** The bubbles beside a speaker's card (a group from speakerGroups), like chatterSlotsHtml. */
export function speakerChatterHtml(model, group) {
    return bubblesHtml(model, group?.lines);
}

/**
 * The "Others" line under the cards for chatter from names that match no present card, or ''.
 * `speakerless`: only the lines with no speaker (named speakers get cards, see speakerGroups).
 */
export function othersSlotsHtml(model, { speakerless = false } = {}) {
    const others = (Array.isArray(model?.others) ? model.others : []).filter(other => !speakerless || other.speaker === null);
    if (!others.length) return '';
    const items = others.map(other => `<span class="npc-state-delta-chatter-other">${model.kind === 'speech' ? `<span class="npc-state-delta-bubble-order" aria-hidden="true">${Number(other.order)}</span>` : ''}${other.speaker === null ? '' : slotHtml('b', 'npc-state-delta-chatter-speaker', other.speaker)}${slotHtml('span', 'npc-state-delta-chatter-said', other.text)}</span>`).join('');
    return `<p class="npc-state-delta-chatter-others ${model.kind === 'speech' ? 'npc-state-delta-chatter-speech' : 'npc-state-delta-chatter-thought'}"><span class="npc-state-delta-kicker">Others</span>${items}</p>`;
}
