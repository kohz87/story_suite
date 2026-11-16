// Story Suite v2: the record copy SillyTavern keeps in `swipe_info`. Records are stored once on `extra`;
// only the last carrier and carriers with several swipes keep the shown swipe's copy for swipe/branch reads. Public face: re-exports its parts.

export { keepsCopy, swipeLoading } from './copies-parts/state.js';
export { mirrorCopy, restoreCopy, dropCopy } from './copies-parts/write.js';
