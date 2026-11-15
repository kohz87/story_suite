// Shared DOM, reader-setting and reply helpers for the page furniture; public helpers remain exported by ui-host.js. Public face: re-exports its parts.

export { IDS, S } from './shared-parts/names.js';
export { el, iconButton } from './shared-parts/dom-build.js';
export { isGameViewKey } from './shared-parts/game-view-key.js';
export { hasReplyRecord } from './shared-parts/reply-record.js';
export { hudOn, readerStore } from './shared-parts/reader-settings.js';
