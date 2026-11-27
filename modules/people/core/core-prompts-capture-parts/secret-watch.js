/* The STORY EVENTS watch for an opened pack secret: the words sent, and the reader's view without them. */

// The watch's event for a pack secret that may come out: it quotes the secret's start.
const secretWatchEvent = text => `the secret "${String(text ?? '').slice(0, 60)}" comes out`;

// In either form of the watch (./hidden-notes.js) the event ends at the next item, or at the rule that follows the list.
const SENT = /: the secret "[\s\S]*?" comes out(?= \| |\. An event counts|\. Return top-level)/g;

/** The sent text as the reader may see it: such an item reads "key = Name: 1 hidden note", as the tail's hidden-note lines do. */
const hideSecretWatch = text => String(text ?? '').replace(SENT, ': 1 hidden note');

export { secretWatchEvent, hideSecretWatch };
