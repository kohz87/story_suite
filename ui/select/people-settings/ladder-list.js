// The People page's Feeling presets and Stage ladder rows: the presets in use (NPC State's `presets` ids, picked by name) and the reader's
// ladder rungs (`ladder`), each marked when the engine leaves it out, and the note when the feature that uses it is off.
import { normalizeMeterSettings, wordKey, clean, isObject, STAGE_NAME_MAX, MILESTONE_MAX, TRACK_MAX, FEATURE_PRESETS, FEATURE_STAGES } from '../../../modules/people/meters/npc-meters-config.js';
import { presetIds, MAX_PRESETS } from '../../../modules/people/meters/npc-meters-presets.js';
import { listRow } from './meter-list.js';

const PRESETS_HINT = 'Companion, Rival, Mentor and pack sets; none are on until you pick them';
const PRESETS_OFF = ' · Feeling presets and rules is off (People module above): picked sets are kept but not used';
const LADDER_OFF = 'Stage ladders and milestones is off (People module above): the ladder is kept but not used.';

const rungItem = raw => ({
  name: clean(raw?.name, STAGE_NAME_MAX), needs: typeof raw?.needs === 'string' ? clean(raw.needs, 120) : '', milestone: clean(raw?.milestone, MILESTONE_MAX), track: clean(raw?.track, TRACK_MAX),
});
const rungs = v => (Array.isArray(v) ? v.filter(isObject).map(rungItem) : []);

/** The Feeling presets row: chips named after the catalog's presets; a pick keeps the order they were turned on in, and ids the catalog does not offer now (a pack turned off) stay stored. */
export function presetsRow() {
  return listRow('Feelings', 'presets', 'chips', 'Feeling presets (up to 12)', 'presets', {
    hint: PRESETS_HINT,
    view: (b, env) => ({
      options: env.catalog.map(p => p.name),
      value: presetIds(b.presets).map(id => env.catalog.find(p => p.id === id)?.name).filter(Boolean),
      hint: env.on(FEATURE_PRESETS) ? PRESETS_HINT : PRESETS_HINT + PRESETS_OFF,
    }),
    write: (v, b, env) => {
      if (!Array.isArray(v)) return null;
      const ids = v.map(name => env.catalog.find(p => p.name === String(name))?.id);
      if (ids.some(id => !id)) return null;
      const picked = new Set(ids);
      const stored = presetIds(b.presets);
      const known = new Set(env.catalog.map(p => p.id));
      const next = [...stored.filter(id => !known.has(id) || picked.has(id)), ...[...picked].filter(id => !stored.includes(id))];
      return [['presets', next.slice(0, MAX_PRESETS)]];
    },
  });
}

/** The Stage ladder row: the reader's rungs in order (name, what it needs, a story milestone, a track; no track is everyone's). */
export function ladderRow() {
  return listRow('Stages', 'stageLadder', 'btn', 'Stage ladder', 'ladder', {
    hint: 'The named rungs and what each needs', options: ['Edit the ladder'],
    view: (b, env) => {
      const items = rungs(b.ladder);
      const { ladder } = normalizeMeterSettings({ customMeters: b.customMeters, ladder: items }, { presets: [], stagesOn: true });
      const seen = new Set();
      const unused = items.flatMap((r, i) => {
        const key = `${r.track}|${wordKey(r.name)}`;
        const out = !(Object.hasOwn(ladder, r.track) ? ladder[r.track] : []).some(x => x.key === wordKey(r.name) && x.name === r.name) || seen.has(key);
        seen.add(key);
        return out ? [i] : [];
      });
      return { list: { items, unused, note: env.on(FEATURE_STAGES) ? null : LADDER_OFF } };
    },
    write: v => (Array.isArray(v) ? [['ladder', rungs(v)]] : null),
  });
}
