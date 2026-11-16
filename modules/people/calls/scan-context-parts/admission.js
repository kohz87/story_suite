/* NPC State Delta: the story prose used to admit a new person. */
import { storyProse } from '../../core/core.js';

/**
 * The story's own prose for admitting a new person: messages 0..`upTo` (the scanned reply, nothing later), faded and system
 * messages left out, each reduced to narration and dialogue (storyProse). The World State rosters, the hidden Notebook
 * and the other blocks never count; the greeting's prose does. A name only those hold is background, not met in the story.
 */
export function storyTextsForAdmission(chat, upTo = Infinity) {
    const list = Array.isArray(chat) ? chat.slice(0, Number.isInteger(upTo) && upTo >= 0 ? upTo + 1 : undefined) : [];
    return list
        .filter(message => message && !message.is_system)
        .map(message => storyProse(String(message.mes || '')))
        .filter(Boolean);
}
