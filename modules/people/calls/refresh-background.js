/* NPC State Refresh: rule 3's background quote (role: refresh-background). A Refresh may change a person's background only with a quote of the story
   that shows it (profileUpdates.evidence.background, kept like the other slow fields' evidence). The quote must be in the window it read (the same
   token check a first seed uses); a background with no grounded quote is left out of the answer, and the stored evidence keeps only the grounded quotes. */

import { durableSeedGrounded } from '../core/core-relationship.js';
import { normalizeProfileEvidence } from '../core/core-evidence.js';

const BACKGROUND_KEYS = ['background', 'backgroundState', 'backgroundReason', 'background_state', 'background_reason'];

/** The quotes of the profile row's `evidence.background` that the window holds ([mN] marks removed). */
export function groundedBackgroundQuotes(profile, transcript) {
    const raw = profile?.evidence ?? profile?.profileEvidence ?? profile?.profile_evidence ?? profile?.observations ?? {};
    const text = String(transcript || '');
    return (normalizeProfileEvidence(raw).background || []).filter(quote => {
        const bare = quote.replace(/\[m\d+\]/g, ' ').trim();
        return bare && durableSeedGrounded(bare, text);
    });
}

/** The answer's `npcs` row and profile row, with the background left out when no grounded quote backs it, and the evidence cut to the grounded quotes. */
export function applyBackgroundRule(row, profile, transcript) {
    const quotes = groundedBackgroundQuotes(profile, transcript);
    const nextRow = row && !quotes.length ? Object.fromEntries(Object.entries(row).filter(([key]) => !BACKGROUND_KEYS.includes(key))) : row;
    const strip = item => (item && !quotes.length ? Object.fromEntries(Object.entries(item).filter(([key]) => !BACKGROUND_KEYS.includes(key))) : item);
    profile = strip(profile);
    if (!profile) return { row: nextRow, profile };
    const raw = profile.evidence ?? profile.profileEvidence ?? profile.profile_evidence ?? profile.observations;
    if (!raw || typeof raw !== 'object') return { row: nextRow, profile };
    return { row: nextRow, profile: { ...profile, evidence: { ...raw, background: quotes } } };
}
