/* NPC State's look at the open chat's branch (role: chat-branch). The lineage a chat's state stands on (noted with each change NPC State makes, seeded
   when a chat opens), the host's swipe state, the wait for a new chat's state file, and the stale-chat mark that keeps a chat shorter than a dossier
   adopted from another session from overwriting that dossier's lineage. The branch journal that used to roll the dossiers back (checkpoints, the
   rollback journal, a branch inheriting its parent's dossiers) is gone (B4-10a): the store's timeline moves the people with the head. Built by
   runtime-entry.js once per module instance with the shared runtime state. */

import { chatContext as getContext } from '../calls/runtime-scan-helpers.js';
import { BRANCH_LINEAGE_VERSION, chatLineage, firstLineageDivergence } from '../lineage/index.js';
import { currentWriterId, prunePortraitAssetsInPlace } from '../storage/storage.js';
import { getSettings } from '../settings/runtime-settings.js';

export function createChatBranchPart(rt, deps) {
    const { getChatKey, getChatState, isCanonicalChatKey, storeOwnsState = () => false } = deps;
    const { missingSidecarChats, branchInheritanceChecked, staleHostChats, openingHostChats } = rt;

    // A change of NPC State's own stands on the chat as it is now, and drops the pictures it no longer needs: without the store, those of people
    // it no longer holds; while the store holds the chat, only those of people the reader deleted (the store can bring anyone else back).
    // On a stale chat the stored lineage is the adopted dossier's (newer) one and the state stays as it is.
    function noteChatLineage(state) {
        if (staleHostActive()) return state;
        state.lineage = chatLineage(getContext().chat || []);
        state.branchLineageVersion = BRANCH_LINEAGE_VERSION;
        prunePortraitAssetsInPlace(state, { keepHeld: storeOwnsState() === 'hosted' });
        return state;
    }

    function seedBranchTracking(state = getChatState()) {
        const lineage = chatLineage(getContext().chat || []);
        if (!Array.isArray(state.lineage) || state.lineage.length === 0) state.lineage = lineage;
        state.branchLineageVersion = BRANCH_LINEAGE_VERSION;
        return state;
    }

    function hostSwipeState() {
        try {
            const state = getContext().swipe?.state?.();
            return typeof state === 'string' && state ? state : 'none';
        } catch {
            return 'none';
        }
    }

    function isHostSwipeActive() {
        return hostSwipeState() !== 'none';
    }

    /**
     * A chat whose state file was looked for and not found, is not saved yet, and has not been decided. Until then a reply received meanwhile
     * waits for the settle pass (runtime-settle.js deferLoadingReceipt) and the page counts as busy. Kept as it was when this decided a branch's
     * inheritance of its parent chat's dossiers (removed at B4-10a): without the store a chat is decided when it opens (decideBranch); while the
     * store holds the chat it never was, so a chat opened after the store took it stays pending until its file is saved (B4-10b removes this
     * with the sidecar).
     */
    function branchInheritancePending(key = getChatKey()) {
        if (!isCanonicalChatKey(key) || branchInheritanceChecked.has(key)) return false;
        if (!missingSidecarChats.has(key) || getSettings().dataFiles?.[key]?.path) return false;
        return true;
    }

    // Where the parent chat's dossiers were looked for when a chat opened: without the store there is nothing left to wait for.
    function decideBranch(key = getChatKey()) {
        if (isCanonicalChatKey(key) && storeOwnsState() !== 'hosted') branchInheritanceChecked.add(key);
    }

    // After adopting another session's newer dossier, the local chat is stale when it does not contain
    // that dossier's whole history: an older prefix, or older history plus a turn typed locally since.
    function noteAdoptedDossier(key, state, writerId = '') {
        if (key !== getChatKey() || openingHostChats.has(key)) return;
        if (writerId && String(writerId) === currentWriterId()) return;
        const stored = Array.isArray(state?.lineage) ? state.lineage : [];
        const divergence = firstLineageDivergence(stored, chatLineage(getContext().chat || []));
        if (stored.length && divergence !== -1 && divergence < stored.length) staleHostChats.add(key);
    }

    // Messages this browser adds locally (a new turn, a reply) do not load the missing remote history,
    // so only a host reload or a local chat that contains the whole adopted lineage clears the mark.
    function staleHostActive(key = getChatKey()) {
        if (!staleHostChats.has(key) || key !== getChatKey()) return false;
        const stored = Array.isArray(getChatState(key)?.lineage) ? getChatState(key).lineage : [];
        const live = chatLineage(getContext().chat || []);
        if (live.length >= stored.length && [-1, stored.length].includes(firstLineageDivergence(stored, live))) {
            staleHostChats.delete(key);
            return false;
        }
        return true;
    }

    return { noteChatLineage, seedBranchTracking, hostSwipeState, isHostSwipeActive, branchInheritancePending, decideBranch, noteAdoptedDossier, staleHostActive };
}
