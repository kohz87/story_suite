// Story Director v2, tracker part (domain): validates the whole `director` slice.

import { closed, hash, map, recordId } from '../thread-shape.js';
import { lineKey } from '../../../changes.js';
import { slotValue } from '../../slot.js';
import { initiativeErrors } from '../initiative.js';
import { PROBLEM_KEY, PROBLEM_ROOM } from './shared-problem-keys.js';
import { STEP_CEILING, STEP_KEY } from './shared-step-keys.js';
import { isInt, isRecord } from './shared-guards.js';
import { threadErrors } from './thread-errors.js';

// The most the validator lets the list hold (a replay after a delete never adds more than were kept).
const PROBLEM_CEILING = 2 * PROBLEM_ROOM;

/** `validate(slice, state) → string[]` (SPEC §2.5). */
export function validateDirector(slice) {
    if (!isRecord(slice)) return ['director is not an object.'];
    const errors = [];
    const minutes = slice.time?.minutes;
    if (!isRecord(slice.time) || !(minutes === null || isInt(minutes))) errors.push('director.time.minutes must be null or whole minutes.');
    if (!isRecord(slice.threads)) errors.push('director.threads is not an object.');
    else for (const [id, thread] of Object.entries(slice.threads)) errors.push(...threadErrors(id, thread));
    if (!isRecord(slice.keys)) errors.push('director.keys is not an object.');
    else {
        for (const [name, id] of Object.entries(slice.keys)) {
            if (!Object.hasOwn(slice.threads ?? {}, id)) errors.push(`director.keys["${name}"] points at no thread.`);
        }
        for (const thread of Object.values(slice.threads ?? {})) {
            if (thread?.key && thread.status === 'active' && slice.keys[lineKey(thread.key)] !== thread.id) errors.push(`"${thread.key}" is missing from director.keys.`);
        }
    }
    if (slice.writes !== undefined && (!map(slice.writes) || Object.entries(slice.writes).some(([id, entry]) => !recordId(id)
        || !closed(entry, ['fingerprint', 'result']) || !hash(entry.fingerprint) || !map(entry.result)))) errors.push('director.writes is invalid.');
    const problems = slice.problems;
    const badProblem = problem => !isRecord(problem) || typeof problem.kind !== 'string' || typeof problem.text !== 'string' || !isInt(problem.rev);
    if (Array.isArray(problems)) {
        // An older state's list.
        if (problems.length > PROBLEM_ROOM) errors.push(`director.problems must be a list of at most ${PROBLEM_ROOM}.`);
        else if (problems.some(badProblem)) errors.push('director.problems entries need rev, kind and text.');
    } else if (!isRecord(problems) || Object.keys(problems).length > PROBLEM_CEILING || Object.keys(problems).some(key => !PROBLEM_KEY.test(key))) {
        errors.push(`director.problems must hold at most ${PROBLEM_CEILING} problems under "<rev>.<n>" keys.`);
    } else if (Object.values(problems).some(badProblem)) {
        errors.push('director.problems entries need rev, kind and text.');
    }
    const steps = slice.steps;
    // Replay can hold more than the writer keeps (shared-step-keys.js STEP_CEILING).
    if (steps !== undefined && (!isRecord(steps) || Object.keys(steps).length > STEP_CEILING || Object.entries(steps).some(([key, entry]) => !STEP_KEY.test(key)
        || !isRecord(entry) || typeof entry.thread !== 'string' || typeof entry.text !== 'string' || Array.from(entry.text).length > 600 || !isInt(entry.turn) || entry.turn < 0 || !isInt(entry.place) || entry.place < -1))) {
        errors.push(`director.steps must hold at most ${STEP_CEILING} { thread, text, turn, place } entries under "<reply>.<n>" keys.`);
    }
    const turn = slice.turn;
    const legacy = isRecord(turn) && !Object.hasOwn(turn, 'now');
    const now = legacy ? turn : slotValue(turn?.now);
    if (!isRecord(turn) || !isInt(turn.n) || turn.n < 0
        || (legacy ? !Array.isArray(turn.quests) : !(turn.now === null || (Array.isArray(turn.now) && turn.now.length === 1 && isRecord(now))))
        || (now && (!Array.isArray(now.quests) || !(now.from === null || isInt(now.from)) || !(now.lone === null || isRecord(now.lone))))) {
        errors.push('director.turn is malformed.');
    }
    errors.push(...initiativeErrors(slice), ...pulseErrors(slice));
    return errors;
}

// The World pulse's slots (pulse/effects.js): the last results, at most 5, and the quiet flag.
function pulseErrors(slice) {
    const errors = [];
    const value = Array.isArray(slice?.pulse) && slice.pulse.length === 1 ? slice.pulse[0] : null;
    if (slice?.pulse !== undefined && slice.pulse !== null && (!isRecord(value) || !Array.isArray(value.results) || value.results.length > 6
        || value.results.some(entry => !isRecord(entry) || !isInt(entry.at) || !(entry.clock === null || entry.clock === undefined || isInt(entry.clock)) || typeof entry.kind !== 'string' || typeof entry.text !== 'string'
            || !(entry.d20 === undefined || (isInt(entry.d20) && entry.d20 >= 1 && entry.d20 <= 20)) || !(entry.skipped === undefined || typeof entry.skipped === 'string')
            || !(entry.effect === undefined || isRecord(entry.effect))))) {
        errors.push('director.pulse must be null or [{ results: [at most 5 of { at, clock, kind, text, … }] }].');
    }
    const quiet = slice?.pulseQuiet;
    if (quiet !== undefined && quiet !== null && !(Array.isArray(quiet) && quiet.length === 1 && isRecord(quiet[0]) && typeof quiet[0].on === 'boolean')) errors.push('director.pulseQuiet must be null or [{ on }].');
    return errors;
}
