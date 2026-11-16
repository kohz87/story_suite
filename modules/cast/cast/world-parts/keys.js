// Building world fingerprints and planner cache keys.

import { sha256 } from '../../hash.js';
import { dayOf, peopleOf } from '../domain.js';

/** A short fingerprint of who is in the world (keys and join minutes): in-flight plans are told apart by it, chat from chat. */
export const fingerprint = (slice, chatId = '') => sha256(JSON.stringify([chatId, peopleOf(slice).map(person => [person.key, person.joined])])).slice(0, 12);

export const batchKey = (print, due) => `batch|${print}|${due.from}|${due.to}`;
export const judgeKey = (print, now) => `judge|${print}|${dayOf(now)}`;
