// Host setup and scripted-play helpers for the matrix runner, moved unchanged from run.js: the seeded
// crypto and global swap around createHost, the live host wrapper, module keys, reply text, module facts,
// setup/play and the peer query stand-in.
//
// Public face: re-exports its parts.

export { oneLine, boot, withHost } from './host-parts/boot.js';
export { label, keysOf, activeOf } from './host-parts/keys.js';
export { replyText, factsOf, runSetups, play } from './host-parts/script.js';
export { queryNames, hostilePeer } from './host-parts/peers.js';
