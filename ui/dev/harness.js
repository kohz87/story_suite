// Dev harness: mounts the suite on the fake port with theme, variant and width switches (also driven by the URL query).

import { h, clear } from '../kit/dom.js';
import { mountSuite } from '../mount.js';
import { createFakePort } from '../port/fake-port.js';
import { usePortraits } from './portraits.js';

const THEMES = ['dark', 'light', 'follow'];
const VARIANTS = ['default', 'rpgOff', 'fightOpen', 'empty'];
const WIDTHS = [360, 390, 820, 1280];
const PLANS = ['off', 'on'];
const FIGHT_STEPS = ['offer', 'choose', 'target', 'ally', 'after', 'end', 'real', 'realafter']; // fight board steps 1, 2, 3 (target), ally, 4, 5; then a captured v1 fight, choosing and after one exchange
const SCENES = ['off', 'open', 'staged', 'sent', 'invalidated']; // the Scene tab: off, or an interaction in that state
const BAG_LOADS = ['light', 'over', 'heavy']; // bag load variants: 0, 1 (the anvil), 2 (the sack)

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * Builds the harness controls and mounts the suite in `frame`. Query: theme, variant, width, tab, plan (on/off),
 * fight (a board step; opens the fight), bag (a load variant).
 * Returns `{ port, state, apply(patch), suite() }`; `apply` remounts with a changed theme, variant or width.
 */
export function startHarness({ doc = globalThis.document, search = '', controls, frame, schedule } = {}) {
  const query = new URLSearchParams(search);
  const state = {
    theme: pick(query.get('theme'), THEMES, 'dark'),
    variant: pick(query.get('variant'), VARIANTS, query.has('fight') ? 'fightOpen' : 'default'), // ?fight= is read once, here
    width: Number(query.get('width')) || 390,
    tab: query.get('tab') || 'now',
    plan: pick(query.get('plan'), PLANS, 'off'),
    fight: pick(query.get('fight'), FIGHT_STEPS, 'choose'),
    bag: pick(query.get('bag'), BAG_LOADS, 'light'),
    scene: pick(query.get('scene'), SCENES, 'off'),
    long: query.get('long') === '1',
    kind: pick(query.get('kind'), ['ferry', 'fight'], 'ferry'), // the scene's kind: the made-up ferry choice or the fight
  };
  let port = null;
  let suite = null;
  let stopPortraits = null;

  // The variant plus the plan, fight-step and bag-load switches, in the form `fixture()` takes.
  function fixtureOptions() {
    return {
      rpg: state.variant !== 'rpgOff',
      fightOpen: state.variant === 'fightOpen',
      empty: state.variant === 'empty',
      planShown: state.plan === 'on',
      fightState: state.fight,
      bagLoad: BAG_LOADS.indexOf(state.bag),
      scene: state.scene === 'off' ? null : state.scene,
      sceneLong: state.long,
      sceneFight: state.kind === 'fight',
    };
  }

  // The Story plan switch records a command; the fake port has no engine, so rebuild the fixture with the new plan state.
  function honourPlanToggle(target) {
    const command = target.command.bind(target);
    target.command = (type, payload, options) => {
      if (type === 'prefs.spoiler.set' && payload?.level === 'plan') {
        state.plan = payload.value ? 'on' : 'off';
        target.setVariant(fixtureOptions());
      }
      return command(type, payload, options);
    };
  }

  function mount() {
    suite?.destroy();
    clear(frame);
    port = createFakePort({ variant: fixtureOptions() });
    honourPlanToggle(port);
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
    if (patch.plan) state.plan = pick(patch.plan, PLANS, state.plan);
    if (patch.fight) {
      state.fight = pick(patch.fight, FIGHT_STEPS, state.fight);
      state.variant = 'fightOpen'; // a fight button opens the fight for that variant; a variant button decides again
    }
    if (patch.scene) state.scene = pick(patch.scene, SCENES, state.scene);
    if (patch.kind) state.kind = pick(patch.kind, ['ferry', 'fight'], state.kind);
    if (patch.bag) state.bag = pick(patch.bag, BAG_LOADS, state.bag);
    mount();
    return { ...state };
  }

  const group = (key, values) => values.map(value => h('button', {
    type: 'button', 'data-key': key, 'data-value': String(value), onClick: () => apply({ [key]: value }),
  }, `${key}: ${value}`));
  controls?.replaceChildren(...group('theme', THEMES), ...group('variant', VARIANTS), ...group('width', WIDTHS),
    ...group('plan', PLANS), ...group('fight', FIGHT_STEPS), ...group('scene', SCENES), ...group('kind', ['ferry', 'fight']), ...group('bag', BAG_LOADS));

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
