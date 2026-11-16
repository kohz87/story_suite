/* NPC State Delta portrait actions: finishing a device upload and removing a portrait. */
import {
    api, closeOverlay, currentSessionIs, flushDurably,
    npcById, recordToolEvent, setBusy, stage1Refresh,
} from '../../legacy/dossier-tools-core.js';
import { targetPortrait } from '../portrait-tools-targets.js';

function toast(kind, message) { globalThis.toastr?.[kind]?.(message); }

export async function finishUploadedPortrait(session, file) {
    try {
        const applied = await api()?.setPortrait?.(session.npcId, file, { chatKey: session.chatKey, isCurrent: () => currentSessionIs(session), form: session.form || '' });
        if (!applied) throw new Error('The portrait target changed; stale image result was rejected.');
        const live = npcById(session.npcId);
        if (!currentSessionIs(session)) throw new Error('The portrait workflow is no longer current; late completion was rejected from this workflow.');
        const saved = await flushDurably(session.chatKey, 'device portrait');
        if (!currentSessionIs(session)) return;
        stage1Refresh();
        if (saved.persisted) toast('success', `NPC State Delta: ${live.name} portrait updated and saved.`);
        else toast('warning', `NPC State Delta: portrait applied locally, but durable save failed. ${saved.error?.message || saved.error}`);
        closeOverlay({ reason: 'portrait-applied', session });
    } catch (error) {
        recordToolEvent('portrait-completion', {
            chatKey: session.chatKey,
            npcId: session.npcId,
            action: 'device portrait',
            outcome: 'rejected-or-failed',
            stale: /stale|changed|no longer|current/i.test(String(error?.message || error)),
            detail: error?.message || error,
        });
        if (!currentSessionIs(session)) return;
        setBusy(session, false, error?.message || String(error));
        toast('error', `NPC State Delta portrait: ${error?.message || error}`);
    }
}

export async function removePortrait(session) {
    if (!currentSessionIs(session) || session.busy) return;
    const npc = npcById(session.npcId);
    if (!npc || !targetPortrait(npc, session.form)) return;
    setBusy(session, true, 'Removing portrait without changing the dossier...');
    try {
        if (!await api()?.removePortrait?.(session.npcId, { chatKey: session.chatKey, form: session.form || '' })) throw new Error('The portrait target is no longer current.');
        const saved = await flushDurably(session.chatKey, 'portrait removal');
        if (!currentSessionIs(session)) return;
        stage1Refresh();
        toast(saved.persisted ? 'success' : 'warning', saved.persisted
            ? `NPC State Delta: portrait removed from ${npc.name} and saved.`
            : `NPC State Delta: portrait removed locally, but durable save failed. ${saved.error?.message || saved.error}`);
        closeOverlay({ reason: 'portrait-removed', session });
    } catch (error) {
        if (!currentSessionIs(session)) return;
        setBusy(session, false, error?.message || String(error));
        toast('error', `NPC State Delta portrait removal: ${error?.message || error}`);
    }
}
