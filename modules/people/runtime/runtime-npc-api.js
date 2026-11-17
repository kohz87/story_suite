/* NPC State - the in-page api (role: npc-api). What `pageHandles.suiteApi` holds: the tracked NPCs, their profiles and the text
   the next reply gets (Key people and the Story Block adapter read it), plus what the Enable checkbox does after saving.
   Built by index.js once per module instance with the shared runtime state and the controller functions it calls. */

import { recentTranscript } from '../transcript/transcript.js';
import { buildNarrationCapturePrompt } from '../core/core.js';
import { pageHandles } from './handles.js';
import { isTerminalNpcDeath } from '../core/terminal-lifecycle.js';
import { buildNpcProfiles } from '../npc-api/profile-list.js';
import { replyPreview } from '../npc-api/reply-preview.js';
import { getSettings, effectiveCustomFieldNames } from '../settings/runtime-settings.js';

export function createNpcApiPart(rt, deps) {
    const { chatHydrationStatus, effectivePresentCastChoice, getChatKey, getChatState, hostedNotePromptOptions, liveInjectionText, narrationCaptureEnabled, queueInlineRender, renderDossier, scannerPromptOptions, scenePresenceView, startInlineWatchdog, updateInjection } = deps;

    // The texts the next ordinary reply gets: { injection, capture }.
    function nextReplyTexts() {
        const settings = getSettings();
        const key = getChatKey();
        if (settings.enabled === false || key === 'no-chat' || chatHydrationStatus(key) !== 'ready') return { injection: '', capture: '' };
        const state = getChatState(key);
        const transcript = recentTranscript(4);
        const injection = settings.inject ? liveInjectionText(state, settings, { transcript }) : '';
        const capture = narrationCaptureEnabled(settings)
            ? buildNarrationCapturePrompt(scannerPromptOptions(state, settings, transcript, { dossierAbove: injection, ...hostedNotePromptOptions(state, settings) }))
            : '';
        return { injection, capture };
    }

    const SUITE_API = Object.freeze({
        /** The current chat's tracked NPCs (copies; empty until the chat's dossiers load). */
        npcs: () => {
            const key = getChatKey();
            if (key === 'no-chat' || chatHydrationStatus(key) !== 'ready') return [];
            return scenePresenceView(getChatState(key).npcs || []).map(npc => ({
                id: String(npc?.id || ''),
                name: String(npc?.name || ''),
                aliases: [...(npc?.aliases || [])],
                present: Boolean(npc?.present),
                archived: isTerminalNpcDeath(npc),   // a confirmed death is out of the cast list
            }));
        },
        /** The tracked, non-archived, not-deceased NPCs' { id, name, aliases, present, role, summary } (frozen copies; empty until the chat's dossiers load). */
        npcProfiles: () => {
            try {
                const key = getChatKey();
                if (key === 'no-chat' || chatHydrationStatus(key) !== 'ready') return Object.freeze([]);
                return buildNpcProfiles(scenePresenceView(getChatState(key).npcs || []), { customFieldNames: effectiveCustomFieldNames() });
            } catch (error) {
                console.warn('[NPC State Delta] NPC profiles failed', error);
                return Object.freeze([]);
            }
        },
        manage: Object.freeze({
            /** What NPC State sends with the next ordinary reply ({ label, text, parts }); never throws. */
            preview: () => {
                try {
                    const result = nextReplyTexts();
                    return replyPreview({ injection: result?.injection, capture: result?.capture });
                } catch (error) {
                    console.warn('[NPC State Delta] reply preview failed', error);
                    return replyPreview();
                }
            },
        }),
    });

    // The "What's sent" fold: each part the next ordinary reply gets, with its size, as text.
    function renderWhatsSent() {
        const root = globalThis.document?.querySelector?.('[data-delta-whats-sent]');
        if (!root) return;
        const { parts } = SUITE_API.manage.preview();
        root.replaceChildren();
        if (!parts.length) {
            const empty = document.createElement('small');
            empty.className = 'delta-whats-sent-empty';
            empty.textContent = 'Nothing is sent with the next reply (no present NPC, or injection and one-pass capture are off).';
            root.append(empty);
            return;
        }
        for (const part of parts) {
            const head = document.createElement('div');
            head.className = 'delta-whats-sent-head';
            head.textContent = `${part.label} · about ${part.tokens} tokens`;
            const body = document.createElement('pre');
            body.className = 'delta-whats-sent-text';
            body.textContent = part.text;
            root.append(head, body);
        }
    }

    // What the Enable checkbox does after saving.
    function afterEnabledChange() {
        updateInjection();
        renderDossier();
        // The in-chat cast leaves with NPC State and comes back with it.
        try { pageHandles.deltaApi?.renderInline?.(); } catch { /* the cards follow at the next render */ }
        if (typeof CustomEvent === 'function') globalThis.document?.dispatchEvent?.(new CustomEvent('npc-state-delta:enabled-changed', { detail: { enabled: getSettings().enabled !== false } }));
    }

    // When NPC State registers with a Story Block host, or that host goes away: the in-chat cast's "Only in Story Block" default
    // and the settings shown for it follow.
    function watchHost() {
        globalThis.document?.addEventListener?.('npc-state-delta:v2-host', () => {
            try { $('#npc_state_delta_present_cast_display').val(effectivePresentCastChoice()); } catch { /* settings not mounted */ }
            startInlineWatchdog();
            queueInlineRender(0);
        });
    }

    return { SUITE_API, renderWhatsSent, afterEnabledChange, watchHost };
}
