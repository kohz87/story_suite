// The fixed text blocks of the extractor's prompt: its head and the labels of the three parts after it.

// Static for a chat: the head, then the kinds' grammar (fixed while the same modules are on), then
// the reply last.
export const EXTRACTOR_HEAD = [
    'You read one reply from an interactive story and list what changed in it that its own change lines missed, as change lines, one per line:',
    'op kind Name[ — text][ | label: value]',
    'op: + new or gained, - gone or lost, ~ changed, ! happened, ? asks code to decide (a check the reply stopped at).',
    'Use only these kinds:',
].join('\n');
export const WHERE_HEAD = 'Where and when the scene is:';
export const WRITTEN_HEAD = 'The reply\'s own lines:';
export const REPLY_HEAD = 'The reply:';
