// Checks a module's `interactions` field (INTERACTION-PLAN §1.1): one plain refusal sentence per bad field of each kind.

import { DEFAULT_LIMITS } from '../interaction/contract.js';
import { isObject } from './shared-basics.js';

const KIND = /^[a-z][a-z0-9_-]*$/;
const COMMAND = /^[a-z][a-zA-Z0-9_-]*(?:\.[a-zA-Z0-9_-]+)*$/;
const SCREEN = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/;
const TITLE_MAX = 24;
const FUNCTIONS = ['ready', 'open', 'witness', 'validate', 'play', 'settle', 'note'];
const OPTIONAL_FUNCTIONS = ['actors', 'auto', 'opening', 'view'];
/** The members of a kind this host knows (an unknown one is only warned about). */
export const KIND_KEYS = Object.freeze(['version', 'title', 'feature', 'screen', 'limits', 'changes', ...FUNCTIONS, ...OPTIONAL_FUNCTIONS, 'carry', 'next', 'marker']);

const whole = value => Number.isSafeInteger(value) && value > 0;

function limitProblems(limits, at) {
    if (!isObject(limits)) return [`${at} limits is not an object (use {} for the defaults)`];
    const out = [];
    for (const [key, value] of Object.entries(limits)) {
        if (!Object.hasOwn(DEFAULT_LIMITS, key)) out.push(`${at} limits names "${key}", which is not a limit (${Object.keys(DEFAULT_LIMITS).join(', ')})`);
        else if (!(whole(value) || (key === 'noteTokens' && value === null))) out.push(`${at} limit "${key}" is not a whole number above zero${key === 'noteTokens' ? ' or null' : ''}`);
    }
    return out;
}

function kindProblems(kind, def) {
    const at = `interaction "${kind}"`;
    if (!isObject(def)) return [`${at} is not an object`];
    const out = [];
    if (!whole(def.version)) out.push(`${at} version is not a whole number above zero`);
    if (typeof def.title !== 'string' || !def.title.trim()) out.push(`${at} has no title (text)`);
    else if ([...def.title].length > TITLE_MAX) out.push(`${at} title is longer than ${TITLE_MAX} characters`);
    if (def.feature === undefined || (def.feature !== null && (typeof def.feature !== 'string' || !def.feature))) out.push(`${at} feature is not a feature id (or null for always on)`);
    if (typeof def.screen !== 'string' || !SCREEN.test(def.screen)) out.push(`${at} screen is not a screen id (like "module/${kind}")`);
    out.push(...limitProblems(def.limits, at));
    if (!Array.isArray(def.changes) || def.changes.some(type => typeof type !== 'string' || !COMMAND.test(type))) out.push(`${at} changes is not a list of command names`);
    for (const key of [...FUNCTIONS, ...OPTIONAL_FUNCTIONS]) {
        if (def[key] === undefined && OPTIONAL_FUNCTIONS.includes(key)) continue;
        if (typeof def[key] !== 'function') out.push(`${at} ${key} is not a function`);
    }
    if ((def.carry === undefined) !== (def.next === undefined)) out.push(`${at} must have both carry and next, or neither`);
    else if (def.carry !== undefined && def.carry !== true) out.push(`${at} carry is not true`);
    else if (def.next !== undefined && typeof def.next !== 'function') out.push(`${at} next is not a function`);
    if (def.marker !== undefined) {
        const marker = def.marker;
        if (!isObject(marker) || typeof marker.word !== 'string' || !marker.word) out.push(`${at} marker has no word (like { word: "battle" })`);
        else if (marker.feature !== undefined && (typeof marker.feature !== 'string' || !marker.feature)) out.push(`${at} marker feature is not a feature id`);
    }
    return out;
}

/** The problems with a definition's `interactions` field: [] when it has none or all are fine. */
export function interactionProblems(def) {
    if (def.interactions === undefined) return [];
    if (!isObject(def.interactions)) return ['interactions is not an object (like { fight: { … } })'];
    return Object.entries(def.interactions).flatMap(([kind, item]) => (KIND.test(kind)
        ? kindProblems(kind, item) : [`the interaction name "${kind}" must be lowercase letters, digits, "_" or "-"`]));
}

/** The members of each kind this host does not know, as plain sentences. */
export function interactionWarnings(def) {
    if (!isObject(def.interactions)) return [];
    return Object.entries(def.interactions).flatMap(([kind, item]) => (isObject(item) ? Object.keys(item)
        .filter(key => !KIND_KEYS.includes(key)).map(key => `"${key}" on interaction "${kind}" is not an interaction field this Story Block knows; it is ignored`) : []));
}
