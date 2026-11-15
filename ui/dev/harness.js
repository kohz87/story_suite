// Dev harness: mounts the suite on the fake port with theme, variant and width switches (also driven by the URL query).

import { h, clear } from '../kit/dom.js';
import { mountSuite } from '../mount.js';
import { createFakePort } from '../port/fake-port.js';
import { usePortraits } from './portraits.js';

const THEMES = ['dark', 'light', 'follow'];
const VARIANTS = ['default', 'rpgOff', 'fightOpen', 'empty'];
const WIDTHS = [360, 390, 820, 1280];

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Builds the harness controls and mounts the suite in `frame`. Query: theme, variant, width, tab.
 * Returns `{ port, state, apply(patch), suite() }`; `apply` remounts with a changed theme, variant or width.
 */
export function startHarness({ doc = globalThis.document, search = '', controls, frame, schedule } = {}) {
  const query = new URLSearchParams(search);
  const state = {
    theme: pick(query.get('theme'), THEMES, 'dark'),
    variant: pick(query.get('variant'), VARIANTS, 'default'),
    width: Number(query.get('width')) || 390,
    tab: query.get('tab') || 'now',
  };
  let port = null;
  let suite = null;
  let stopPortraits = null;

  function mount() {
    suite?.destroy();
    clear(frame);
    port = createFakePort({ variant: state.variant });
    frame.style.width = `${state.width}px`;
    suite = mountSuite({ port, doc, host: frame, theme: state.theme, initial: state.tab, schedule });
    suite.open(state.tab);
    stopPortraits?.();
    stopPortraits = typeof globalThis.MutationObserver === 'function' ? usePortraits(frame) : null;
  }

  function apply(patch = {}) {
    if (patch.theme) state.theme = pick(patch.theme, THEMES, state.theme);
    if (patch.variant) state.variant = pick(patch.variant, VARIANTS, state.variant);
    if (patch.width) state.width = Number(patch.width) || state.width;
    if (patch.tab) state.tab = patch.tab;
    mount();
    return { ...state };
  }

  const group = (key, values) => values.map(value => h('button', {
    type: 'button', 'data-key': key, 'data-value': String(value), onClick: () => apply({ [key]: value }),
  }, `${key}: ${value}`));
  controls?.replaceChildren(...group('theme', THEMES), ...group('variant', VARIANTS), ...group('width', WIDTHS));

  mount();
  return { get port() { return port; }, state, apply, suite: () => suite };
}

if (typeof globalThis.location !== 'undefined' && globalThis.document?.getElementById) {
  const doc = globalThis.document;
  const frame = doc.getElementById('hx-frame');
  if (frame) {
    globalThis.storySuiteHarness = startHarness({ doc, search: globalThis.location.search, controls: doc.getElementById('hx-controls'), frame });
  }
}
