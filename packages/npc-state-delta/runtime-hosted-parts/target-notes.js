/* NPC State Delta hosted target notes (role: hosted-target-notes). What a targeted pass (backfill, Refresh) is asked about hidden notes
   while hosted, and the prompt options that follow from it. Moved from runtime-hosted.js without change; the factory takes the two
   closures it read there. */
import { getSettings } from '../runtime-settings.js';

export function createTargetNotes({ storySuiteV2Meters, hostedEventWatch }) {
    // (v2 hidden notes) What a targeted pass (backfill, Refresh) is asked about hidden notes: { layered, watch } or null when
    // nothing is asked (not hosted, or no setting and no event note to look for). `layered`: this dossier is new (a backfill
    // queued at admission) and has no notes yet. `watch`: this one person's locked event notes, when they are present.
    // `tastes` (Refresh only): the pass also asks for this person's tastes (the notes feature on) and forwards them (forwardTastesToHost).
    function hostedTargetNotes(npc, { newDossier = false, messageId = null, tastes = false } = {}) {
        const adapter = storySuiteV2Meters();
        if (!adapter || !npc) return null;
        const layered = newDossier && getSettings().layeredSecrets !== false && !(Array.isArray(npc.secrets) && npc.secrets.length);
        const watch = hostedEventWatch({ npcs: [npc] }, messageId);
        const asked = tastes === true && adapter.asksTastes?.() === true;
        return layered || watch.length || asked ? { layered, watch, ...(asked ? { tastes: true } : {}) } : null;
    }
    const targetNoteOptions = notes => ({
        ...(notes?.layered ? { layeredSecrets: true } : {}),
        ...(notes?.watch?.length ? { eventWatch: notes.watch } : {}),
        ...(notes?.tastes ? { askTastes: true } : {}),
    });

    return { hostedTargetNotes, targetNoteOptions };
}
