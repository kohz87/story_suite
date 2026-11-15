// The problems of a record's mood and pull fields (feature mood-pull).
import { isInt, isObject, readLeaf } from '../npc-meters-config.js';
import { normalizeMood, readMoodLog } from '../../npc-mood.js';
import { INSTINCT_KINDS } from '../../npc-instincts.js';

// The mood and pull fields (feature mood-pull): small whole numbers and short plain text, as the cores write them.
const LEAF_TEXT_MAX = 1200;
const shortText = (value, max) => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f]/.test(value);
export function moodPullProblems(record) {
    const out = [];
    const [mood, inst, pull, track, moodLog] = [record.mood, record.inst, record.pull, record.track, record.moodLog].map(readLeaf);
    if ([record.mood, record.inst, record.pull, record.track, record.moodLog].some(raw => typeof raw === 'string' && (raw.length > LEAF_TEXT_MAX || readLeaf(raw) === undefined))) out.push('has an unreadable text leaf');
    if (mood !== undefined && (!isObject(mood) || JSON.stringify(normalizeMood(mood)) !== JSON.stringify(Object.fromEntries(Object.keys(normalizeMood(mood)).map(key => [key, mood[key]]))))) out.push('has an unusable mood');
    if (moodLog !== undefined && (!isObject(moodLog) || !Array.isArray(moodLog.e) || readMoodLog(moodLog).length !== moodLog.e.length)) out.push('has an unusable mood history');
    if (inst !== undefined && (!isObject(inst) || Object.keys(inst).some(key => !['belo', 'clos', 'awe'].includes(key)) || Object.values(inst).some(value => !isInt(value) || value < 0 || value > 3))) out.push('has unusable instincts');
    if (pull !== undefined && (!isObject(pull) || !INSTINCT_KINDS.includes(pull.kind) || !shortText(pull.cause, 120) || !isInt(pull.since) || pull.since < 0 || Object.keys(pull).length !== 3)) out.push('has an unusable pull');
    if (track !== undefined) {
        const ok = isObject(track) && Object.keys(track).every(key => ['party', 'join', 'bench', 'threads', 'places'].includes(key))
            && [track.party].every(value => value === undefined || value === 0 || value === 1)
            && [track.join, track.bench].every(value => value === undefined || (isInt(value) && value >= 0))
            && (track.threads === undefined || (isObject(track.threads) && Object.keys(track.threads).length <= 6 && Object.entries(track.threads).every(([id, day]) => id.length > 0 && id.length <= 40 && isInt(day) && day >= 0)))
            && (track.places === undefined || (Array.isArray(track.places) && track.places.length <= 6 && track.places.every(name => shortText(name, 60) && name.length > 0)));
        if (!ok) out.push('has an unusable pull memory');
    }
    return out;
}
