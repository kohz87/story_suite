// Story Suite v2: swipe marks and payload text. A mark says which swipe a record was written for without
// trusting a numeric index alone; payload text is the reply up to its change block, used by replay evidence. Public face: re-exports its parts.

export { hash, payloadText } from './marks-parts/payload.js';
export { swipeMark, markFits, markStale } from './marks-parts/mark.js';
