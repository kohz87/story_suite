// Builds the Chat extras page of the Settings view-model: its module (Choices, Inner chatter, Your look) and the two Inner chatter rows.

import { CORE_SETTINGS } from '../../modules/scene/domains/core/constants.js';
import { EXTRAS_FEATURES } from './extras-keys.js';

const ids = new Set(Object.values(EXTRAS_FEATURES));
const shortOf = id => Object.keys(EXTRAS_FEATURES).find(k => EXTRAS_FEATURES[k] === id);

/** Mock v7's Chat extras module card text (settings-extra.js: desc, off line and the ≈ token figure). */
const CARD = { id: 'extras', name: 'Chat extras', icon: '✦', section: 'extras', desc: 'Small things around each reply', off: 'Replies read as plain text; the rest of the suite is unchanged.', tokens: 180 };

/** Returns the two Inner chatter rows from Story Block's own settings (`values`: sdk.settings('story-block')), the schema's label, limits and default. */
export function extrasRows(values) {
  const v = values && typeof values === 'object' ? values : {};
  const { defaults, schema } = CORE_SETTINGS;
  return [
    { key: 'extras.sendBack', group: 'Inner chatter', type: 'sw', label: schema.chatterInPrompt.label.replace(/'/g, '’'), hint: null, value: v.chatterInPrompt === true, default: defaults.chatterInPrompt, options: null, unit: null, tags: [], wide: false },
    { key: 'extras.chatterLines', group: 'Inner chatter', type: 'num', label: schema.chatterMax.label, hint: null, value: Number.isFinite(v.chatterMax) ? v.chatterMax : defaults.chatterMax, default: defaults.chatterMax, options: null, unit: null, tags: [], wide: false },
  ];
}

/** Moves Choices, Inner chatter and Your look out of the Story Block module into a Chat extras module: `parts` = { defList, set } (moduleParts), `features` the feature list. */
export function withExtras(parts, features) {
  const mine = (Array.isArray(features) ? features : []).filter(f => f && ids.has(f.id));
  if (!mine.length) return parts;
  const defList = parts.defList.map(d => ({ ...d, subs: d.subs.filter(s => !ids.has(s.key)) }));
  const subs = mine.map(f => {
    const sub = { key: shortOf(f.id), label: String(f.label ?? f.id), hint: String(f.describe ?? ''), on: f.on === true };
    if (f.available === false && typeof f.why === 'string') sub.needs = f.why;
    return sub;
  });
  const set = { ...parts.set };
  for (const d of defList) if (set[d.id]) set[d.id] = { on: d.subs.some(s => s.on), subs: Object.fromEntries(d.subs.map(s => [s.key, s.on])) };
  set[CARD.id] = { on: subs.some(s => s.on), subs: Object.fromEntries(subs.map(s => [s.key, s.on])) };
  return { defList: [...defList.filter(d => d.subs.length), { ...CARD, subs }], set };
}
