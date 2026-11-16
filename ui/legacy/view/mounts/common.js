// Story Suite v2: what every mount shares (SPEC §13.4). A mount picks the state to show (the head, or a
// reply's own state for inline cards), resolves the screen and its data bindings against that state, and
// hands the screen to the injected renderer. The template and layout renderers are never imported here:
// whoever wires the mounts passes `render(el, screen, scope)`.
//
// Shared dependencies (`deps`) every controller takes:
//   screens        the registry from ../screens.js (resolve, list, cardsOn, version)
//   render         (el, screen, scope) → void | dispose function | { destroy() }
//   stateAt        (index) → frozen State after carrier `index`
//   headIndex      () → index of the last carrier          (or `head: () => State` instead)
//   query          (name, args, state) → plain value, run against the given state
//   changesAt      (index) → JSON Pointer paths the carrier's ops touched   (optional, default none)
//   settings       () → settings object for `settings.…` paths                (optional)
//   api            { command, preview, commit, query, on } handed to the renderer and widgets
//   enabled        (mount, screenId) → bool  (optional; default: cards only when the reader turned them on)
//   on             (event, fn) → unsubscribe; 'head' and 'committed' redraw head mounts (optional)
//   document       the document to build in (optional, default globalThis.document)
//
// The scope given to the renderer: { state, q, draft, settings, changes, mount, index, screenId, api, query },
// and for cards also { before, replyOps } (the state before the reply, the reply's own ops).
// Public face: re-exports its parts.

export { documentOf, headState, headIndexOf, headStateSafe } from './common-parts/head-state.js';
export { isEnabled, badgeText, activeNow, screensFor } from './common-parts/enabled.js';
export { plainCopy } from './common-parts/plain-copy.js';
export { make, button, icon } from './common-parts/dom.js';
export { dispose } from './common-parts/dispose.js';
export { drawScreen } from './common-parts/draw.js';
export { onHead, mountHead } from './common-parts/head-mount.js';
