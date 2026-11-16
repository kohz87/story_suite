// Announces Delta (or withdraws it) in the Story Suite registry.
import { SUITE_AREAS, SUITE_ID, SUITE_NAME } from './identity.js';
import { safeSuite, storyBlockIsV2 } from './shared-host.js';
// What Delta displays for another extension (docs/STORY_SUITE.md, `shows`): Story Block's NPC
// Inner Chatter, on the Present NPCs cards. Story Block hides its own Chatter tab meanwhile.
export const SUITE_SHOWS = Object.freeze(['chatter']);

/**
 * Announce Delta. Enabled, it offers its four areas and `shows` what it displays for others.
 * Disabled, it announces `enabled: false` without `shows` (keeping `settings` and the api) when
 * its api can switch it back on, so the overlay can; otherwise it withdraws. Returns true while
 * Delta is announced as enabled. With a Story Block v2 host on the page it withdraws (v1's overlay
 * would otherwise carry the same settings panel the v2 section carries).
 */
export function announceNpcStateDelta({ enabled = true, version = '', api = null, settings = '', shows = [], storyBlock = globalThis.StoryBlock } = {}, suite = null) {
    const registry = safeSuite(suite);
    if (!registry) return false;
    try {
        if (storyBlockIsV2(storyBlock) || (!enabled && typeof api?.manage?.setEnabled !== 'function')) {
            registry.withdraw(SUITE_ID);
            return false;
        }
        registry.announce({
            id: SUITE_ID,
            name: SUITE_NAME,
            version: String(version),
            owns: [...SUITE_AREAS],
            enabled: Boolean(enabled),
            ...(enabled && Array.isArray(shows) && shows.length ? { shows: shows.map(String) } : {}),
            ...(settings ? { settings: String(settings) } : {}),
            ...(api ? { api } : {}),
        });
        return Boolean(enabled);
    } catch (error) {
        console.warn('[NPC State Delta] Story Suite announcement failed', error);
        return false;
    }
}
