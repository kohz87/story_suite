// Tags of the enabled Story Block blocks shown in a given way.
import { plain } from './shared-text.js';

/** Tags of the enabled Story Block blocks shown as `display` ('scene', 'chatter'), in list order. */
export function storyBlockTags(blocks, display) {
    try {
        const tags = (Array.isArray(blocks) ? blocks : [])
            .filter(block => block && block.enabled !== false && block.display === display)
            .map(block => plain(block.tag))
            .filter(Boolean);
        return [...new Set(tags)];
    } catch {
        return [];
    }
}
