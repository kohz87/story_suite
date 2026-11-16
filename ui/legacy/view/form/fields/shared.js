// The form engine's shared field helpers: a small element, a button, the label hooks every control uses, the
// disabled state, and the page's fresh control ids.
// Public face: re-exports its parts.

export { button, h } from './shared-parts/elements.js';
export { named, setDisabled } from './shared-parts/controls.js';
export { newId } from './shared-parts/ids.js';
