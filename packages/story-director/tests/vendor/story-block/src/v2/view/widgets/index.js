// The standard widgets Story Block ships (SPEC §13.5), keyed by their namespaced names (`ss.<name>`,
// MODULES §F9), and the building blocks of Story Suite's look (ss.tile, ss.bar, ss.status, ss.pill) and the blocks built from them
// (ss.hero, ss.tiers, ss.listcard, ss.tabs, ss.navbar, ss.dialog).
// Each is `{ props, primary, render(el, props, api) → { update(props), destroy() }, validate(props) }`.

// Public face: re-exports its parts.

export { standardWidgets } from './index-parts/standard.js';
export { badge } from './badge.js';
export { bar, pill, status, tile } from './glass.js';
export { dialog } from './dialog.js';
export { editable } from './editable.js';
export { hero } from './hero.js';
export { listcard } from './listcard.js';
export { navbar, tabs } from './nav.js';
export { tiers } from './tiers.js';
export { map } from './map.js';
export { meter } from './meter.js';
export { portrait } from './portrait.js';
export { radar } from './radar.js';
export { skillTree } from './skill-tree.js';
export { stepper } from './stepper.js';
export { timeline } from './timeline.js';
export { defineWidget, propProblems, resolveProps, unfoldValue } from './props.js';
export { ensureStyles, faClasses, safeImageUrl } from './dom.js';
export { widgetCss } from './styles.js';
