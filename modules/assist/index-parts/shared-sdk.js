// The public Story Block sdk, read when called (null when the host is not there), shared by the assist part's two files.

export const sdk = () => globalThis.StoryBlock?.sdk ?? null;
