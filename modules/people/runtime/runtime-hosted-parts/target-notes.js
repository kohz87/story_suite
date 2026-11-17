/* NPC State Delta hosted target notes (role: hosted-target-notes). What a targeted pass (backfill, Refresh) is asked about hidden notes
   while hosted, and the prompt options that follow from it. Moved from runtime-hosted.js without change; the factory takes the two
   closures it read there. */
import { getSettings } from '../../settings/runtime-settings.js';
import { storedReads } from '../../core/core-prompts-targeted-parts/stored-reads.js';

export function createTargetNotes({ storySuiteV2Meters, hostedEventWatch }) {
    // (v2 hidden notes) What a targeted pass (backfill, Refresh) is asked about hidden notes: { layered, watch } or null when
    // nothing is asked (not hosted, or no setting and no event note to look for). `layered`: this dossier is new (a backfill
    // queued at admission) and has no notes yet. `watch`: this one person's locked event notes, when they are present.
    // `tastes` (Refresh only): the pass is also shown this person's recorded tastes and ties to read (NSD11; read-only, nothing is returned or forwarded).
    function hostedTargetNotes(npc, { newDossier = false, messageId = null, tastes = false } = {}) {
        const adapter = storySuiteV2Meters();
        if (!adapter || !npc) return null;
        const layered = newDossier && getSettings().layeredSecrets !== false && !(Array.isArray(npc.secrets) && npc.secrets.length);
        const watch = hostedEventWatch({ npcs: [npc] }, messageId);
        let reads = null;
        if (tastes === true) {
            try { reads = storedReads(adapter.dossierMeters?.([npc])?.[npc.id]?.notes); } catch { reads = null; }
        }
        return layered || watch.length || reads ? { layered, watch, ...(reads ? { reads } : {}) } : null;
    }
    const targetNoteOptions = notes => ({
        ...(notes?.layered ? { layeredSecrets: true } : {}),
        ...(notes?.watch?.length ? { eventWatch: notes.watch } : {}),
        ...(notes?.reads ? { storedReads: notes.reads } : {}),
    });

    return { hostedTargetNotes, targetNoteOptions };
}
