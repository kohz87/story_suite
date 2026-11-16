/* NPC State Delta tie rows: reading a person's ties for the board and the narrator, with the roster map and tracked-state test. */
import { normalizeName } from '../core-text.js';
import { tieParts } from './entries.js';
import { TIE_FADE_DAYS, TIE_TYPE_RANK, tieType } from './tie-types.js';

const tieFadeDays = type => (type === 'passing' ? TIE_FADE_DAYS.passing : type === 'interest' ? TIE_FADE_DAYS.interest : TIE_FADE_DAYS.high);
const DEAD_TIE = /[;|]\s*(?:deceased|dead)\b|^surviving widow|\((?:deceased|dead)\)/i;

/** Whether this person records ties' last mentions yet (an object `tieSeen`, written by a scan that had a story day). Without it nothing fades. */
export const tiesTracked = npc => !!npc && typeof npc.tieSeen === 'object' && npc.tieSeen !== null && !Array.isArray(npc.tieSeen);

/** The name/alias → person map of a roster, for readTieRows/narratorTies/recordTieMentions: build it once per projection, not per person. */
export function tieRoster(npcs) {
    const map = new Map();
    const labels = new Map();   // person -> every name key they answer to (map.labels), so a mention check never scans the roster
    for (const other of Array.isArray(npcs) ? npcs : []) {
        for (const label of [other?.name, ...(other?.aliases || [])]) {
            if (!label) continue;
            const key = normalizeName(label);
            map.set(key, other);
            labels.set(other, [...(labels.get(other) || []), key]);
        }
    }
    map.labels = labels;
    return map;
}

/**
 * The ties of one person, read for the board and the narrator: [{ entry, name, key, type, rank, seen, state }] in priority order
 * (high types, then Interest, then Passing; most recently mentioned first inside a type). `state`: 'active', 'faded' (not mentioned for
 * its tier's days), 'left' (the other person is archived), 'died' (a death mark or the other person's life state). Only when
 * tiesTracked(npc) does anything leave 'active'; an older chat reads exactly as before. `day`: the story day now (null: no fading by time).
 * `tags(name)`: optional pack/player tie tags of the person. `roster`: tieRoster(npcs) built once by a caller that reads many people (else built here).
 */
export function readTieRows(npc, { npcs = [], day = null, tags = () => [], roster = null } = {}) {
    const tracked = tiesTracked(npc);
    const others = roster || tieRoster(npcs);
    const rows = (Array.isArray(npc?.keyRelationships) ? npc.keyRelationships : []).map((entry, index) => {
        const { text, name, rest } = tieParts(entry);
        const key = normalizeName(name);
        const type = tieType(rest, tags(name));
        const seenRaw = tracked ? npc.tieSeen[key] : undefined;
        const seen = Number.isInteger(seenRaw) ? seenRaw : null;
        const other = others.get(key);
        let state = 'active';
        if (tracked) {
            if (DEAD_TIE.test(`${rest} ${text}`) || other?.lifeState === 'deceased') state = 'died';
            else if (other?.archived) state = 'left';
            else if (seen !== null && Number.isInteger(day) && day - seen >= tieFadeDays(type)) state = 'faded';
        }
        return { entry: text, name, key, type, rank: TIE_TYPE_RANK[type], seen, state, index, quiet: seen !== null && Number.isInteger(day) ? Math.max(0, day - seen) : null };
    });
    return rows.sort((a, b) => a.rank - b.rank || (b.seen ?? -1) - (a.seen ?? -1) || a.index - b.index);
}

/** The ties the narrator may be told of: active ones in priority order, plus a died/left one only when `scene` (text) names the person. */
export function narratorTies(npc, { npcs = [], day = null, scene = '', tags, roster = null } = {}) {
    const sceneText = normalizeName(scene);
    return readTieRows(npc, { npcs, day, tags, roster }).filter(row => row.state === 'active'
        || (row.state === 'died' && row.key && sceneText.includes(row.key)));
}
