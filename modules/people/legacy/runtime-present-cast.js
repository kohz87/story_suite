/* NPC State Delta present-cast markup: portraits, cards and the roster HTML the Cast and World panes
   draw (the cards are never drawn in the chat). Their now lines get their text through
   fillPresentSceneText. */

import { currentPresentationText, formPortraitFor } from '../core/core.js';
import { portraitSrc } from '../portrait/portrait-file.js';
import { nowSlotHtml, presentSceneModel, rememberPresentScene, sceneAttr } from './present-scene.js';
import { escapeHtml } from '../util/html.js';

export function createPresentCastPart(deps) {
    const { chatHydrationStatus, getChatKey, getChatState, latestMessageId, scenePresenceView } = deps;

    // Like the dossier, the present cast shows the current form's own portrait when that form has one,
    // and the main portrait otherwise.
    function portraitMarkup(npc, displayName, placeholderClass = 'npc-state-delta-inline-avatar-placeholder') {
        const formImage = npc?.currentForm ? formPortraitFor(getChatState().formPortraitAssets, npc.id, npc.currentForm) : null;
        const portraitUrl = formImage?.dataUrl || portraitSrc(npc?.portrait);
        if (portraitUrl) return `<img src="${escapeHtml(portraitUrl)}" alt="${escapeHtml(displayName)} portrait">`;
        const initial = String(displayName || '?').trim().charAt(0).toUpperCase() || '?';
        return `<div class="${placeholderClass}" aria-hidden="true"><span>${escapeHtml(initial)}</span></div>`;
    }

    function inlineCardHtml(npc, messageId, scene = null) {
        if (!npc || npc.archived || !npc.present || npc.minor) return '';
        const displayName = npc.name || 'NPC';
        // With now lines (Mood, Condition, Outfit) the identity line keeps only the role. The text sits
        // under the portrait so the name and the now lines can wrap instead of being cut to one line.
        const now = nowSlotHtml(scene, npc.id);
        const identityLine = (now ? npc.role : [npc.role, npc.mood].filter(Boolean).join(' · ')) || 'Present NPC';
        const portrait = portraitMarkup(npc, displayName, 'npc-state-delta-present-card-placeholder');
        const card = `
      <button type="button" class="npc-state-delta-present-card" data-npc-id="${escapeHtml(npc.id)}" data-message-id="${messageId}" aria-label="Open ${escapeHtml(displayName)} dossier">
        <span class="npc-state-delta-present-card-portrait">${portrait}</span>
        <span class="npc-state-delta-present-card-text">
          <span class="npc-state-delta-present-card-head"><b class="npc-state-delta-present-card-name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</b>${npc.followed === true ? '<span class="npc-state-delta-key-tag" title="Followed">★ Key</span>' : ''}<span class="npc-state-delta-present-card-stage"></span></span>
          <small class="npc-state-delta-present-card-role" title="${escapeHtml(identityLine)}">${escapeHtml(identityLine)}</small>${now}
        </span>
      </button>`;
        // One cell per NPC: the card, then what narrow panes show in the row's right half: the now lines
        // (the same slots as on the card; the wide grid shows them on the card and hides this copy, narrow
        // panes the reverse), else the role and "No changes this turn". Tapping anywhere in the cell,
        // the right half included, opens the dossier.
        const side = now ? `<div class="npc-state-delta-present-side npc-state-delta-present-side-now">${now}</div>`
            : `<div class="npc-state-delta-present-side npc-state-delta-present-side-idle"><small class="npc-state-delta-present-side-role">${escapeHtml(identityLine)}</small><small class="npc-state-delta-present-side-muted">No changes this turn</small></div>`;
        const kind = now ? 'now' : 'idle';
        return `<div class="npc-state-delta-present-cell npc-state-delta-present-cell-${kind}" data-npc-id="${escapeHtml(npc.id)}" data-message-id="${messageId}">${card}${side}</div>`;
    }

    // The now line on each present card, from Delta's own tracked mood, condition and outfit.
    function presentSceneFor(visible) {
        try {
            const cards = visible.map(npc => ({
                id: npc.id,
                name: npc.name,
                aliases: npc.aliases || [],
                mood: npc.mood,
                condition: npc.status,
                outfit: currentPresentationText(npc) || npc.currentForm || '',
            }));
            return rememberPresentScene(presentSceneModel({ cards }));
        } catch (error) {
            console.warn('[NPC State Delta] present scene skipped', error);
            return null;
        }
    }

    function inlineRosterHtml(cards, messageId) {
        // Hosted, the scene says who is here (read time, nothing written), so a card and Story Block's list cannot disagree.
        const currentById = new Map((scenePresenceView?.(getChatState().npcs) ?? getChatState().npcs).map(npc => [npc.id, npc]));
        const visible = (cards || []).map(card => currentById.get(card.id)).filter(npc => npc?.present && !npc.archived && !npc.minor);
        if (!visible.length) return '';
        const scene = presentSceneFor(visible);
        return `
      <section class="npc-state-delta-present-roster" data-message-id="${messageId}"${sceneAttr(scene)}>
        <div class="npc-state-delta-present-roster-head"><span class="npc-state-delta-kicker">PRESENT NPCS</span><small>${visible.length} shown</small></div>
        <div class="npc-state-delta-present-grid">${visible.map(npc => inlineCardHtml(npc, messageId, scene)).join('')}</div>
      </section>`;
    }

    // The Cast tab's cast: the live present NPCs as full cards.
    function storyBlockCastHtml() {
        const key = getChatKey();
        if (key === 'no-chat' || chatHydrationStatus(key) !== 'ready') return '';
        const present = scenePresenceView(getChatState(key).npcs).filter(npc => !npc.archived && npc.present && !npc.minor);
        return inlineRosterHtml(present, latestMessageId(true));
    }

    return { storyBlockCastHtml };
}
