/* NPC State Delta reply-scan result follow-ups (role: reply-scan-result). What a committed scan does with its merged result: seeding
   the cast's first-meeting details into the dossiers it admitted, and telling the reader about stale dossiers it archived or deleted.
   Moved from runtime-scan.js without change. */
import { rememberCastAdmissions, seedCastAdmission } from '../../runtime/runtime-cast-sync.js';
import { dossierFor, metWithEntry } from '../../dossier/cast-dossier.js';
import { normalizeSourceOfTruth } from '../../legacy/suite-handshake.js';
import { notify } from '../runtime-scan-helpers.js';

/** Remembers the new dossiers' cast admissions and seeds each one that matches exactly one met cast person (hosted scans only). */
export function seedNewAdmissions(nextState, newlyAdmittedIds, { targetMessageId, currentLineage, settings, castList, storySuiteV2Meters }) {
    rememberCastAdmissions(nextState, newlyAdmittedIds, targetMessageId, currentLineage);
    const people = metWithEntry(castList?.());
    const names = storySuiteV2Meters?.()?.packNames?.() ?? {};
    for (const npc of nextState.npcs.filter(item => newlyAdmittedIds.includes(item.id))) {
        const matches = people.filter(person => dossierFor([npc], person));
        if (matches.length !== 1 || nextState.npcs.filter(other => dossierFor([other], matches[0])).length !== 1) continue;
        const person = matches[0];
        const seeded = seedCastAdmission(nextState, npc, person, { packName: names[person.pack] ?? '', calendarOwn: normalizeSourceOfTruth(settings.sourceOfTruth).calendar === 'mine' });
        if (seeded) nextState.npcs = nextState.npcs.map(item => item.id === npc.id ? seeded : item);
    }
}

/** The quiet notice for an automatic scan that archived or deleted stale dossiers (nothing when it did neither). */
export function notifyStaleCleanup(report) {
    if (!(report.staleArchived || []).length && !(report.stalePruned || []).length) return;
    const archivedCount = (report.staleArchived || []).length;
    const removed = report.stalePruned || [];
    const names = removed.slice(0, 3).map(item => item.name).join(', ');
    const extra = removed.length > 3 ? ` +${removed.length - 3} more` : '';
    const parts = [];
    if (archivedCount) parts.push(`${archivedCount} stale archived`);
    if (removed.length) parts.push(`${removed.length} stale deleted${names ? ` (${names}${extra})` : ''}`);
    notify('info', `NPC State Delta: ${parts.join(', ')}. Deleted stale NPCs can be rediscovered if they return.`);
}

/** The story contradicted a stored gender and the stored word stayed (report.warnings, set by mergeScanResult): one warning per person. */
export function notifyGenderConflicts(report) {
    for (const w of report?.warnings || []) {
        notify('warning', `NPC State: the story calls ${w.name} ${w.story}, but ${w.dead ? 'they have died and' : 'the dossier says'} ${w.kept}${w.dead ? ' is kept' : ' (kept; change it in the editor if the story is right)'}.`);
    }
}
