// NPC State's hosted reading of Story Director's people away (`director.away`, read only, through the adapter): the "While away" note the narrator
// gets once with a returned person's dossier, the scan hold of those away now, and their dossier ids for the stale pass's keep list.

import { chatContext as getContext } from '../../calls/runtime-scan-helpers.js';
import { storyMinuteText } from '../../core/core.js';
import { normalizeAwayAnswer } from '../../away/away-read.js';
import { returnNote } from '../../away/away-memory.js';
import { awayDossierIds } from '../../away/away-hold.js';

/** `{ awayReturnNotes(state), awayScanOptions(state), awayKeepIds(state) }` over the adapter `storySuiteV2Meters()`. */
export function createAwayHosted(rt, { getChatKey, latestReplyIndex, storySuiteV2Meters }) {
    // The answer cleaned, its dates written on Story Director's calendar; null with no host or no Story Director (nothing is held then).
    function awayList() {
        const adapter = storySuiteV2Meters();
        if (!adapter) return null;
        try {
            const answer = adapter.awayAnswer?.();
            if (!Array.isArray(answer)) return null;
            const calendar = adapter.directorCalendar?.() ?? null;
            return normalizeAwayAnswer(answer, minutes => storyMinuteText(minutes, calendar));
        } catch {
            return null;
        }
    }
    // The index of the reply the story stands on for the next generation: the latest reply, or the one before it while the latest is being replaced.
    function headIndex() {
        const latest = latestReplyIndex();
        const chat = getContext().chat || [];
        if (!rt.replacingReply || rt.replacingReply.key !== getChatKey() || latest < 0 || chat[latest] !== rt.replacingReply.message) return latest;
        for (let at = latest - 1; at >= 0; at -= 1) if (chat[at] && !chat[at].is_system && !chat[at].is_user) return at;
        return -1;
    }
    // What the narrator is told once about people who just came back: { dossier id: "WHILE AWAY, NOW BACK …" }, or null.
    function awayReturnNotes(state) {
        const list = awayList();
        if (!list?.length) return null;
        const head = headIndex();
        const memory = storySuiteV2Meters()?.awayMemory?.() ?? {};
        const notes = {};
        for (const npc of state?.npcs || []) {
            const note = npc?.id ? returnNote(list, memory, npc, head) : '';
            if (note) notes[npc.id] = note;
        }
        return Object.keys(notes).length ? notes : null;
    }
    // The merge option that holds the stable fields of those away now for one automatic scan: { heldAwayIds } or nothing.
    function awayScanOptions(state) {
        const list = awayList();
        const ids = list?.length ? awayDossierIds(list, state?.npcs) : new Set();
        return ids.size ? { heldAwayIds: [...ids] } : {};
    }
    // The dossier ids of those away now (the stale pass archives, never deletes, them).
    const awayKeepIds = state => {
        const list = awayList();
        return list?.length ? [...awayDossierIds(list, state?.npcs)] : [];
    };
    return { awayReturnNotes, awayScanOptions, awayKeepIds };
}
