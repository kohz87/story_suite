// `story-block/inspector` (MODULES §F92): a read-only look inside the story's bookkeeping, one reply at a
// time, for beta testers and pack authors. Pick a reply; see what changed since the reply before it (the
// state compared path by path, and the ops as stored), its receipts and its problems, and its whole
// state as a tree that folds open, with a search over keys and values. Nothing here runs a command.
//
// The screen is a template around one host widget, `story-block.inspector`, which ui-host.js builds
// with createInspectorWidget(source) over the store (src/v2/inspect.js createInspectorSource): a widget
// is the one place code enters a screen (SPEC §13), and the inspector needs the store's replay of
// older replies, which no query (they read one state) can give. The screen and the widget belong to
// the `story-block.inspector` feature (MODULES §F100), off by default.
//
// Every text, key and value is set with textContent: a state holds what the model wrote.
//
// Public face: re-exports its parts.

export { INSPECTOR_SCREEN_ID, INSPECTOR_WIDGET, INSPECTOR_FEATURE, inspectorScreen } from './inspector-parts/screen.js';
export { drawTree } from './inspector-parts/tree.js';
export { createInspectorWidget } from './inspector-parts/widget.js';
