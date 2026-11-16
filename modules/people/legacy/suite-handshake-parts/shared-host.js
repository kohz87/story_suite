// Host probes every handshake part shares: is Story Block v2 on the page, and a never-throwing suite registry lookup.
import { storySuite } from '../suite.js';
/**
 * True when the page's Story Block is version 2 (`apiVersion: 2`). A v2 host carries Delta through
 * its sdk (src/storysuite-v2.js: the Cast tab and the settings section), so Delta then offers it
 * nothing of v1's: no Present NPCs / Dossiers tabs, no Story Suite announcement for v1's overlay,
 * no "Open Story Suite" button. A v1 Story Block (apiVersion 1) or none changes nothing.
 */
export function storyBlockIsV2(storyBlock = globalThis.StoryBlock) {
    try {
        return storyBlock?.apiVersion === 2;
    } catch {
        return false;
    }
}

export function safeSuite(suite) {
    try {
        return suite || storySuite();
    } catch {
        return null;
    }
}
