// Decides whether Delta's panel offers "Manage all in Story Suite" and opens that overlay.
import { SUITE_ID } from './identity.js';
import { safeSuite, storyBlockIsV2 } from './shared-host.js';
/**
 * Whether Delta's panel shows "Manage all in Story Suite": two or more extensions announced (on
 * or off, as the overlay counts them) and Story Block sharing openSuite.
 */
export function suiteManageAvailable(suite = null, storyBlock = globalThis.StoryBlock) {
    if (storyBlockIsV2(storyBlock)) return false;
    const registry = safeSuite(suite);
    if (!registry) return false;
    try {
        return registry.providers().length >= 2 && typeof registry.api('story-block')?.openSuite === 'function';
    } catch {
        return false;
    }
}

/** Open Story Suite's overlay on Delta's tab; false when the overlay is unavailable or fails. */
export function openSuiteOverlay(suite = null, storyBlock = globalThis.StoryBlock) {
    const registry = safeSuite(suite);
    if (!suiteManageAvailable(registry, storyBlock)) return false;
    try {
        registry.api('story-block').openSuite(SUITE_ID);
        return true;
    } catch (error) {
        console.warn('[NPC State Delta] Story Suite overlay failed to open', error);
        return false;
    }
}
