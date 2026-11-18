// The People page's Custom feelings and Per-feeling stages rows: each reads NPC State's stored list (customMeters, stages), marks the entries
// the engine leaves out (normalizeMeterSettings), and writes the edited list back under the same key.
import { normalizeMeterSettings, meterDefs, slug, clean, intOr, isObject, TONES, LABEL_MAX, STAGE_NAME_MAX, MAX_CUSTOM_METERS, FEATURE_PRESETS } from '../../../modules/people/meters/npc-meters-config.js';
import { row } from './kit-more.js';

const list = v => (Array.isArray(v) ? v.filter(isObject) : []);
const text = v => (typeof v === 'string' ? v : '');

/**
 * A row whose editor is a list (the mock's button row, or chips): `view(bucket, env)` adds what the page shows (`list`: { items, unused, note,
 * meters? }, or options and hint); `write(value, bucket, env)` gives the pairs to store. Reset leaves a list alone (it is the reader's content).
 */
export const listRow = (group, key, type, label, store, { hint, options = null, view, write }) => row(group, key, type, label, { hint, options, store, reset: [], read: () => null, view, write });

/** One custom meter as stored (the host schema's fields: name, min, max, start, show, tone, describe, bands, drift, driftTo), cleaned. */
function meterItem(raw) {
  const o = isObject(raw) ? raw : {};
  return {
    name: clean(o.name ?? o.label ?? o.id, LABEL_MAX), min: intOr(o.min, 0), max: intOr(o.max, 100), start: intOr(o.start, null),
    show: o.show === false || o.show === 'hidden' || o.show === 'no' ? 'hidden' : 'bar', tone: TONES.includes(o.tone) ? o.tone : 'neutral',
    describe: text(o.describe ?? o.rule), bands: text(o.bands), drift: intOr(o.drift, null), driftTo: intOr(o.driftTo, null),
  };
}
const stageItem = raw => ({ meter: clean(raw?.meter, LABEL_MAX), at: intOr(raw?.at, null), name: clean(raw?.name, STAGE_NAME_MAX) });

// The indexes of `items` whose `keep(item)` key the engine did not keep (an empty key, a key not kept, or a repeat of an earlier one).
function unusedOf(items, keyOf, kept) {
  const seen = new Set();
  return items.flatMap((item, i) => {
    const key = keyOf(item);
    const out = !key || !kept(item, key) || seen.has(key);
    seen.add(key);
    return out ? [i] : [];
  });
}

const keptMeters = items => new Set(normalizeMeterSettings({ customMeters: items }, { presets: [] }).custom.map(m => m.id));

/** The Custom feelings row: the reader's own meters (a preset's come with the preset), up to six; a rename also moves the stages that name the meter. */
export function customMetersRow() {
  return listRow('Feelings', 'customMeters', 'btn', 'Custom feelings', 'customMeters', {
    hint: 'Add your own (Fear, Respect, Debt…), up to 6', options: ['Add a meter'],
    view: b => {
      const items = list(b.customMeters).map(meterItem);
      const kept = keptMeters(items);
      return { list: { items, unused: unusedOf(items, m => slug(m.name), (_m, id) => kept.has(id)), note: null } };
    },
    write: (v, b) => {
      if (!Array.isArray(v)) return null;
      const next = list(v).map(meterItem).slice(0, MAX_CUSTOM_METERS);
      const before = list(b.customMeters).map(meterItem);
      const kept = keptMeters(next);
      const moves = new Map();
      if (before.length === next.length) before.forEach((m, i) => { const was = slug(m.name); const now = slug(next[i].name); if (was && now !== was && kept.has(now)) moves.set(was, next[i].name); });
      const stages = list(b.stages);
      const moved = stages.map(s => (moves.has(slug(s.meter)) ? { ...s, meter: moves.get(slug(s.meter)) } : s));
      return [['customMeters', next], ...(moved.some((s, i) => s !== stages[i]) ? [['stages', moved]] : [])];
    },
  });
}

/** The Per-feeling stages row: named thresholds, each on one meter (a built-in, the reader's own or a preset's in use), at most eight a meter. */
export function stagesRow() {
  return listRow('Feelings', 'perMeterStages', 'btn', 'Per-feeling stages', 'stages', {
    hint: 'Named thresholds on one meter (separate from the ladder)', options: ['Edit'],
    view: (b, env) => {
      const settings = normalizeMeterSettings(b, { presets: env.on(FEATURE_PRESETS) ? env.catalog : [] });
      const defs = meterDefs(settings);
      const ids = new Map(defs.flatMap(d => [[d.id, d], [slug(d.label), d]]));
      const items = list(b.stages).map(stageItem).map(s => ({ ...s, meter: ids.get(slug(s.meter))?.label ?? s.meter }));
      const kept = (s, key) => (settings.stages[key.split('|')[0]] ?? []).some(x => x.at === s.at && x.name === s.name);
      return { list: { items, unused: unusedOf(items, s => (ids.get(slug(s.meter)) && s.at !== null && s.name ? `${ids.get(slug(s.meter)).id}|${s.at}` : ''), kept), note: null, meters: defs.map(d => d.label) } };
    },
    write: v => (Array.isArray(v) ? [['stages', list(v).map(stageItem)]] : null),
  });
}
