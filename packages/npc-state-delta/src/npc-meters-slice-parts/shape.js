// The empty slice, the whole-slice validation (§2.5) and the lookup of an entry key by labels. The slice is the people domain's `bonds` (P4): entries are
// keyed by the people's npc_ ids (Delta's makeNpcId rule), the same keys as their dossiers.
// Delta's ids: `npc_` then letters, digits, `-` and `_` (as the people domain checks them).
const PEOPLE_ID = /^npc_[\p{L}\p{N}_-]{1,100}$/u;
import { FORBIDDEN_KEYS, isInt, isObject, isReplyId, MAX_METERS_PER_NPC, MAX_MILESTONES, MAX_NPCS, MAX_PROBLEMS, MAX_UNLOCKED, METER_ID_MAX, MILESTONE_MAX, NAME_MAX, npcKey, RECORD_FIELDS, replyKey, CUSTOM_RANGE, DISPOSITION_MAX, STAGE_NAME_MAX, WORDS } from '../npc-meters-config.js';
import { RELATIONSHIP_KEYS } from '../../core-mechanics.js';
import { flatDayProblems } from '../relationship-pacing.js';
import { readEvent } from '../npc-meters-pacing.js';
import { readApproachRing } from '../../npc-meters-gate.js';
import { validateNotes } from '../npc-notes-kinds.js';
import { validateCast } from './cast-memory.js';
import { validateKeyAway } from './key-away.js';
import { moodPullProblems } from './mood-problems.js';

/** The slice of a chat with no NPC meters yet. */
export function initialNpcSlice() {
    return { npcs: {}, problems: [] };
}

/** Problems with the slice (§2.5): [] when fine. Any problem rejects the command that made it. */
export function validateNpcSlice(slice) {
    const errors = [];
    if (!isObject(slice)) return ['The NPC meters are not a record.'];
    if (!isObject(slice.npcs)) return ['The NPC meters have no list of people.'];
    const keys = Object.keys(slice.npcs);
    if (keys.length > MAX_NPCS) errors.push(`NPC State Delta keeps meters for up to ${MAX_NPCS} people (there are ${keys.length}).`);
    for (const key of keys) {
        const record = slice.npcs[key];
        const where = `The NPC entry "${key}"`;
        if (!PEOPLE_ID.test(key) || FORBIDDEN_KEYS.has(key)) errors.push(`${where} has a key that is not an NPC id (npc_ and a name).`);
        if (!isObject(record)) { errors.push(`${where} is not a record.`); continue; }
        if (typeof record.name !== 'string' || !record.name.trim() || record.name.length > NAME_MAX) errors.push(`${where} has no usable name.`);
        if (!isObject(record.meters)) errors.push(`${where} has no meters.`);
        else {
            const meters = Object.entries(record.meters);
            if (meters.length > MAX_METERS_PER_NPC) errors.push(`${where} has more than ${MAX_METERS_PER_NPC} meters.`);
            for (const [id, value] of meters) {
                if (!WORDS.test(id) || id.length > METER_ID_MAX) errors.push(`${where} has a meter named "${id}", which is not a meter name.`);
                if (!isInt(value) || value < CUSTOM_RANGE.min || value > CUSTOM_RANGE.max) errors.push(`${where}: ${id} must be a whole number from ${CUSTOM_RANGE.min} to ${CUSTOM_RANGE.max} (got ${JSON.stringify(value)}).`);
            }
        }
        if (!isObject(record.stages)) errors.push(`${where} has no stages record.`);
        else for (const [id, name] of Object.entries(record.stages)) {
            if (!WORDS.test(id) || typeof name !== 'string' || !name.trim() || name.length > STAGE_NAME_MAX) errors.push(`${where} has an unusable stage for "${id}".`);
        }
        if (!Array.isArray(record.unlocked)) errors.push(`${where} has no unlocked list.`);
        else {
            if (record.unlocked.length > MAX_UNLOCKED) errors.push(`${where} has more than ${MAX_UNLOCKED} unlocked notes.`);
            if (record.unlocked.some(id => typeof id !== 'string' || !id || id.length > 40)) errors.push(`${where} has an unusable unlocked note id.`);
            if (new Set(record.unlocked).size !== record.unlocked.length) errors.push(`${where} lists an unlocked note twice.`);
        }
        if (record.progress !== undefined) {
            if (!isObject(record.progress) || Object.entries(record.progress).some(([id, part]) => !RELATIONSHIP_KEYS.includes(id) || typeof part !== 'number' || !Number.isFinite(part) || part <= -1 || part >= 1)) {
                errors.push(`${where} has an unusable record of part-points.`);
            }
        }
        if (record.impactDay !== undefined) for (const problem of flatDayProblems(record.impactDay)) errors.push(`${where}'s record of the day's events ${problem}.`);
        if (record.held !== undefined) {
            if (!Array.isArray(record.held) || record.held.length > MAX_UNLOCKED || record.held.some(id => typeof id !== 'string' || !id || id.length > 40)
                || new Set(record.held).size !== record.held.length) errors.push(`${where} has an unusable list of shut notes.`);
        }
        if (record.disposition !== undefined && (typeof record.disposition !== 'string' || record.disposition.length > DISPOSITION_MAX)) errors.push(`${where} has an unusable disposition.`);
        if (record.turn !== undefined) {
            const turn = record.turn;
            if (!isObject(turn) || replyKey(turn.reply, turn.reply) === null || !isObject(turn.from)
                || (turn.at !== undefined && (!isInt(turn.at) || turn.at < 0 || !isReplyId(turn.reply)))
                || Object.values(turn.from).some(value => !isInt(value))
                || (turn.story !== undefined && (!Array.isArray(turn.story) || turn.story.some(id => typeof id !== 'string')))) errors.push(`${where} has an unusable reply window.`);
        }
        if (record.lastEvent !== undefined && !readEvent(record.lastEvent)) errors.push(`${where} has an unusable last event.`);
        if (record.via !== undefined && !readApproachRing(record.via)) errors.push(`${where} has an unusable record of recent approaches.`);
        if (record.milestones !== undefined) {
            const list = isObject(record.milestones) ? Object.entries(record.milestones) : null;
            if (!list) errors.push(`${where} has an unusable milestones record.`);
            else {
                if (list.length > MAX_MILESTONES) errors.push(`${where} has more than ${MAX_MILESTONES} milestones.`);
                if (list.some(([id, name]) => !WORDS.test(id) || id.length > METER_ID_MAX || typeof name !== 'string' || !name.trim() || name.length > MILESTONE_MAX)) errors.push(`${where} has an unusable milestone.`);
            }
        }
        if (record.rank !== undefined && (typeof record.rank !== 'string' || !WORDS.test(record.rank) || record.rank.length > METER_ID_MAX)) errors.push(`${where} has an unusable stage on its ladder.`);
        if (record.low !== undefined && (!isInt(record.low) || record.low < 1 || record.low > 1000)) errors.push(`${where} has an unusable count of replies below its stage.`);
        if (record.day !== undefined && !isInt(record.day)) errors.push(`${where} has an unusable story day.`);
        errors.push(...moodPullProblems(record).map(problem => `${where} ${problem}.`));
        { const bad = validateNotes(record); if (bad) errors.push(`${where} ${bad}`); }
        for (const field of Object.keys(record)) {
            if (!RECORD_FIELDS.includes(field)) errors.push(`${where} has an unknown field "${field}".`);
        }
    }
    if (!Array.isArray(slice.problems)) errors.push('The NPC meters have no problems list.');
    else {
        if (slice.problems.length > MAX_PROBLEMS) errors.push(`The NPC meters keep at most ${MAX_PROBLEMS} problems.`);
        if (slice.problems.some(item => !isObject(item) || !isInt(item.rev) || typeof item.text !== 'string')) errors.push('An NPC meters problem is not { rev, text }.');
    }
    if (slice.keyAway !== undefined) errors.push(...validateKeyAway(slice.keyAway));
    if (slice.cast !== undefined) errors.push(...validateCast(slice.cast));
    for (const field of Object.keys(slice)) if (!['npcs', 'problems', 'keyAway', 'cast'].includes(field)) errors.push(`The NPC meters have an unknown field "${field}".`);
    return errors;
}

/** The entry key for `labels` (an npc_ id, or a name then aliases matched to an entry's name, in that order) in `npcs`, or null. */
export function findNpcKey(npcs, labels = []) {
    if (!isObject(npcs)) return null;
    for (const label of labels) if (typeof label === 'string' && PEOPLE_ID.test(label) && Object.hasOwn(npcs, label)) return label;
    const wanted = labels.map(npcKey).filter(Boolean);
    for (const key of wanted) for (const [id, record] of Object.entries(npcs)) if (npcKey(record?.name) === key) return id;
    return null;
}
