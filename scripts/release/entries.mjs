// The one place that says what the release build packs: one bundle set for the one extension (root index.js, root manifest.json).
// `lazy` lists the modules that stay separate chunks, fetched only when a feature turns on (the RPG library and its screens); every other
// dynamic import is awaited at startup anyway and is packed into the entry (so the People part, which index.js starts at every start, is in the entry).
// `eager` lists a module that must stay a separate chunk although the entry awaits it at start; the release gate counts it, and what it pulls in,
// among the requests of the load. It is empty today.
export const BUNDLE_SETS = [
  { name: 'story-suite', entries: ['index.js'], lazy: ['modules/rpg/index.js', 'modules/rpg/view/index.js', 'ui/legacy/screens/ui-sample.js', 'ui/legacy/view/settings/diagnostics-page.js'], eager: [] },
];
