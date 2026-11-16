// Decides when Delta defers an area to another extension and which extension that is.
import { isSourceOfTruth } from '../suite.js';
import { SUITE_ID } from './identity.js';
import { normalizeSourceOfTruth } from './source-of-truth.js';
import { safeSuite, storyBlockIsV2 } from './shared-host.js';
/** True when another suite extension is the source of truth for `area` under the reader's choice. */
export function defersArea(area, choices = {}, suite = null) {
    // A Story Block v2 host keeps the scene (its `scene.present`) but never fills v1's registry: the
    // reader's "theirs" (and "auto", where the scene specialist wins) defer to it; "mine" keeps it here.
    if (area === 'scene' && storyBlockIsV2()) return normalizeSourceOfTruth(choices).scene !== 'mine';
    const registry = safeSuite(suite);
    if (!registry) return false;
    try {
        return !isSourceOfTruth(SUITE_ID, area, normalizeSourceOfTruth(choices)[area] || 'auto', registry);
    } catch {
        return false;
    }
}

/** The extension Delta defers `area` to, as { id, name }, or null when Delta is the source of truth. */
export function areaOwner(area, choices = {}, suite = null) {
    const registry = safeSuite(suite);
    if (!registry || !defersArea(area, choices, registry)) return null;
    try {
        const owner = registry.owner(area);
        const id = owner && owner !== SUITE_ID ? owner : registry.offering(area).find(other => other !== SUITE_ID);
        if (!id) return null;
        const provider = registry.providers().find(item => item.id === id);
        return { id, name: String(provider?.name || id) };
    } catch {
        return null;
    }
}
