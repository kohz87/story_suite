// The one place that says what the release build packs: one bundle set per extension. B3's single manifest
// replaces these three rows with one; nothing else in scripts/release changes.
// `lazy` lists the modules that stay separate chunks, fetched only when a feature turns on (the RPG library
// and its screens); every other dynamic import is awaited at startup anyway and is packed into the entry.
export const BUNDLE_SETS = [
  { name: 'story-block', dir: 'packages/story-block', entries: ['index.js'], lazy: ['src/v2/lean-rpg/index.js', 'src/v2/lean-rpg/view/index.js', 'src/v2/screens/ui-sample.js', 'src/v2/view/settings/diagnostics-page.js'] },
  { name: 'story-director', dir: 'packages/story-director', entries: ['index.js'], lazy: [] },
  { name: 'npc-state-delta', dir: 'packages/npc-state-delta', entries: ['bootstrap.js'], lazy: [] },
];
