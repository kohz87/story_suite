// A pack entry's list fields (hidden notes, behaviour levers, mannerisms, tastes), each cleaned to Delta's own rules.

import { isBehaviorLever, normalizeBehaviorProfile } from '../../core/core-behavior.js';
import { normalizeMannerisms } from '../../core/core-durable.js';
import { DURABLE_PROFILE_LIMITS } from '../../core/core-relationship.js';
import { BEHAVIOUR_MAX, MANNERISMS_MAX, SECRETS_MAX } from './limits-lists.js';
import { clip, isObject, wholeNumber } from './shared-text.js';

/**
 * The hidden notes of a pack entry as the dossier keeps them: [{ title?, text, meter?, at?, when? }], at most eight. A note opens on
 * a meter value (`meter` + `at`), on a story event (`when`, words, up to 120 characters), or both. The note ids are made by the
 * hidden-notes code (src/npc-meters.js normalizeSecrets) wherever the notes are read, from the rule and text only.
 */
export function castSecrets(raw) {
    const out = [];
    for (const item of Array.isArray(raw) ? raw : []) {
        if (!isObject(item) || out.length >= SECRETS_MAX) continue;
        const text = clip(item.text, 300);
        if (!text) continue;
        const title = clip(item.title, 60);
        const meter = clip(item.meter, 40).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
        const at = wholeNumber(item.at);
        const when = clip(item.when, 120);
        const byMeter = Boolean(meter) && at !== null;
        if (!byMeter && !when) continue;
        out.push({ ...(title ? { title } : {}), text, ...(byMeter ? { meter, at } : {}), ...(when ? { when } : {}), from: 'pack' });
    }
    return out;
}

const sameList = (a, b) => a.length === b.length && a.every((item, index) => item === b[index]);
const LEVER_LINE = /^([^:]{1,40}?)\s*:\s*(low|medium|high)\b\s*[-\u2013\u2014]\s*(\S.*)$/i;

/**
 * The pack's behaviour levers as the dossier stores them: ["Label: level - effect"], at most six. Each item is written in Delta's own
 * form (level low|medium|high) and kept only if Delta's lever rules would keep it as it stands: a recognised lever label, not
 * about the player or one named person (that is "with you"), and not merged into another lever of the same kind. Anything else
 * is skipped, so the stored list is exactly what Delta's normalizer gives back (nothing is changed after the first meeting).
 */
export function castBehaviour(raw) {
    const out = [];
    for (const item of (Array.isArray(raw) ? raw : []).slice(0, BEHAVIOUR_MAX * 4)) {
        if (out.length >= BEHAVIOUR_MAX) break;
        const match = typeof item === 'string' ? LEVER_LINE.exec(clip(item, 400)) : null;
        if (!match) continue;
        const line = clip(`${match[1].trim()}: ${match[2].toLowerCase()} - ${match[3]}`, DURABLE_PROFILE_LIMITS.behaviorProfile);
        const next = [...out, line];
        if (!isBehaviorLever(line) || !sameList(normalizeBehaviorProfile(next), next)) continue;
        out.push(line);
    }
    return out;
}

/** The pack's mannerisms: at most four short habits (160 characters each), kept only when Delta's mannerism rules keep them as they stand (a near-repeat of an earlier one is skipped). */
export function castMannerisms(raw) {
    const out = [];
    for (const item of (Array.isArray(raw) ? raw : []).slice(0, MANNERISMS_MAX * 4)) {
        if (out.length >= MANNERISMS_MAX) break;
        const line = typeof item === 'string' ? clip(item, DURABLE_PROFILE_LIMITS.mannerism) : '';
        const next = [...out, line];
        if (line && sameList(normalizeMannerisms(next), next)) out.push(line);
    }
    return out;
}

// A pack's tastes: [{ sign '+' (likes) | '-' (dislikes), item, from? }], up to 6 likes and 4 dislikes (the notes feature's limits); anything else is dropped.
export function castTastes(raw) {
    const out = [];
    for (const item of Array.isArray(raw) ? raw : []) {
        const text = clip(isObject(item) ? item.item : '', 60);
        const sign = isObject(item) ? (item.sign === '-' || item.sign === 'dislikes' ? '-' : item.sign === '+' || item.sign === 'likes' ? '+' : '') : '';
        if (text && sign && out.filter(row => row.sign === sign).length < (sign === '+' ? 6 : 4)) out.push({ sign, item: text, from: clip(item.from, 60) });
    }
    return out;
}
