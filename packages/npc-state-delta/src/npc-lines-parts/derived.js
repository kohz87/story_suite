// What code derives so the model need not write it (NSD7): `identityKind`, `dossierReason`, `memoryRetention` and `relationshipSummary`, and the people record a
// stub makes. A reply's lines never carry these; the fill-in's rows may, and a value the code derives wins over a missing or unusable one.
import { createNpcRecord } from '../../core-record.js';
import { inferNpcIdentityKind } from '../../core-identity.js';
import { IMPORTANT_MEMORY_LIMIT } from '../../core-record.js';

export const STUB_REASON = 'Named in the story.';

/** → { identityKind, dossierReason, memoryRetention?, relationshipSummary } for a row (the fill-in's, or a stub's) of the person `known` (the dossier now, or null). */
export function derivedFields(row, known = null) {
    const name = String(row?.name ?? known?.name ?? '');
    return {
        // A title alone is no name (the guard): the promotion rule in the merge reads this kind, so it follows the name, never the model's word.
        identityKind: inferNpcIdentityKind(name, known?.identityKind),
        dossierReason: String(row?.dossierReason ?? known?.dossierReason ?? '').trim() || STUB_REASON,
        ...(Array.isArray(row?.memories) && row.memories.length > IMPORTANT_MEMORY_LIMIT ? { memoryRetention: 'top5' } : {}),
        // The summary of the bond is written by the Refresh (N8) from several scenes, never by a line: the dossier's own stays.
        relationshipSummary: String(known?.relationshipSummary ?? ''),
    };
}

/** The people record a stub makes under `id` (`stamp`: the reply's place, 1-based): the dossier a new person starts from, with the role and the look as written, and the derived fields. */
export function stubRecord({ name, role, look }, id, baseline, stamp = 1) {
    const record = createNpcRecord(name, [], baseline);
    const { identityKind, dossierReason } = derivedFields({ name }, null);
    // No clock: the stamp is the reply's place, so a Re-read of the same line makes the same record (replay equals live).
    return { ...record, id, role, appearance: look, identityKind, dossierReason, createdAt: stamp, updatedAt: stamp };
}
