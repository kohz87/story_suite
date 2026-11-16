// The one place that says what the release build packs: one bundle set for the one extension (root index.js, root manifest.json).
// `lazy` lists the modules that stay separate chunks, fetched only when a feature turns on (the RPG library and its screens) or
// that cannot be packed into the entry (the People part starts with a top-level await); every other dynamic import is awaited at
// startup anyway and is packed into the entry.
export const BUNDLE_SETS = [
  { name: 'story-suite', entries: ['index.js'], lazy: ['modules/rpg/index.js', 'modules/rpg/view/index.js', 'ui/legacy/screens/ui-sample.js', 'ui/legacy/view/settings/diagnostics-page.js', 'modules/people/legacy/bootstrap.js'] },
];
