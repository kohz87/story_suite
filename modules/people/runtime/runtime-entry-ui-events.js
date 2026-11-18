/* NPC State Delta - present-card event helpers (role: runtime-entry-ui-events). The present-card activation
   guard, the open-a-dossier call (the view's People dossier, through pageHandles.openPerson) and closest-target lookup split
   from index.js. Built once per module instance with the controller bindings it calls, so the activation memory stays per instance. */
import { pageHandles } from './handles.js';

export function createUiCaptureParts(deps) {
    const { currentNpcById } = deps;
    let lastPresentCardActivation = { npcId: '', at: 0 };
    function eventTargetClosest(event, selector) {
        const path = typeof event?.composedPath === 'function' ? event.composedPath() : [];
        for (const node of path) {
            if (typeof node?.matches === 'function' && node.matches(selector)) return node;
        }
        return typeof event?.target?.closest === 'function' ? event.target.closest(selector) : null;
    }


    // Present-cast cards (and openDossier) open the person's dossier in the Story Suite view, on People.
    function openPersonDossier(npcId) {
        const id = String(npcId || '').trim();
        const npc = id ? currentNpcById(id) : null;
        if (!npc) return false;
        const open = pageHandles.openPerson;
        const opened = typeof open === 'function' && open({ id, name: npc.name }) === true;
        if (!opened) globalThis.toastr?.warning?.(typeof open === 'function' ? `Story Suite has no dossier for ${npc.name || 'this person'} yet.` : 'Story Suite is still starting.');
        return opened;
    }

    function activatePresentCardFromEvent(event) {
        const card = eventTargetClosest(event, '.npc-state-delta-present-card, .npc-state-delta-present-cell');
        if (!card) return false;
        if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return false;
        const npcId = String(card.dataset?.npcId || '').trim();
        if (!npcId) return false;
        const now = Date.now();
        if (lastPresentCardActivation.npcId === npcId && now - lastPresentCardActivation.at < 650) {
            event.preventDefault?.();
            event.stopImmediatePropagation?.();
            event.stopPropagation?.();
            return true;
        }
        lastPresentCardActivation = { npcId, at: now };
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        event.stopPropagation?.();
        openPersonDossier(npcId);
        return true;
    }

    return { eventTargetClosest, openPersonDossier, activatePresentCardFromEvent };
}
