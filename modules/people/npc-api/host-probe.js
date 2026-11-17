// Whether the page's Story Block host is version 2 (`apiVersion: 2`): the one host probe NPC State needs.
/** True when `globalThis.StoryBlock` carries `apiVersion: 2`. Never throws. */
export function storyBlockIsV2(storyBlock = globalThis.StoryBlock) {
    try {
        return storyBlock?.apiVersion === 2;
    } catch {
        return false;
    }
}
