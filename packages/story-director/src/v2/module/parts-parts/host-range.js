// Story Director v2: the Story Block versions this module runs on.

/** The Story Block versions this module runs on (`requires.storyBlock`). */
// 2.19.0 reads a kind spec's `heads` (stray change lines of a kind with no grammar line of its own); 2.25.0 is the least this release runs on.
export const STORY_BLOCK_WITH_HEADS = '2.25.0';
export const STORY_BLOCK_RANGE = `>=${STORY_BLOCK_WITH_HEADS}`;
