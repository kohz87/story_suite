// The job: the versions a pack is checked against.

// The suite's own version (`requires.suite`). Pinned to package.json by a test, so a release bump cannot leave it behind.
export const SUITE_VERSION = '0.1.0';
// The host compatibility number older packs still name (`requires.storyBlock`): kept as it was, so those packs keep loading.
export const HOST_VERSION = '2.33.0';
