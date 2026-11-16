// Reads the host's hooks for the npc part: settings, features, dossier lookups, clock, setup and ladder helpers.
import { normalizeRelationshipCaps } from '../../core-mechanics.js';
import { BUILT_IN_PRESETS, normalizeLimits } from '../npc-meters-presets.js';
import { FEATURE_DEFAULTS, FEATURE_PRESETS, FEATURE_STAGES, MAX_RUNGS, TRACK_MAX, clean, isInt, isObject, meterDefs, normalizeMeterSettings, replyKey, rung } from '../npc-meters-config.js';
import { normalizeAllowance } from '../relationship-pacing.js';
import { clockReaders } from '../npc-meters-pacing.js';

/** The hook readers of one npc part, as the closure the other parts share. */
export function createNpcReaders(hooks) {
    const call = (fn, fallback, ...args) => {
        if (typeof fn !== 'function') return fallback;
        try { return fn(...args) ?? fallback; } catch { return fallback; }
    };
    const resolve = name => {
        const found = call(hooks.resolve, null, name);
        return isObject(found) && typeof found.name === 'string' && found.name.trim() ? found : null;
    };
    const baseline = () => {
        const value = call(hooks.baseline, {});
        return isObject(value) ? value : {};
    };
    // Delta's impact-tier caps, normalized; null when the host gives none (then a story line is held by the per-reply cap alone).
    const tierCaps = () => {
        const value = call(hooks.caps, null);
        return isObject(value) ? normalizeRelationshipCaps(value) : null;
    };
    // The events-per-day allowance and the story day before the reply (null: no clock, or Delta owns the calendar).
    const tierAllowance = () => {
        const value = call(hooks.allowance, null);
        return isObject(value) ? normalizeAllowance(value) : null;
    };
    const { clockMinutes, clockDay, dateOf } = clockReaders(hooks, call);   // the story minute / day / date at a line (npc-meters-pacing.js)
    // The story minute by the host's clock now (a scan's change names no reply); null without a clock.
    const timeMinutes = ctx => {
        try { const minutes = ctx.time(); return isInt(minutes) ? minutes : null; } catch { return null; }
    };
    const rulesFor = (name, aliases = []) => {
        const value = call(hooks.secretRules, [], name, aliases);
        return Array.isArray(value) ? value : [];
    };
    const presentNames = () => {
        const value = call(hooks.present, []);
        return Array.isArray(value) ? value.filter(name => typeof name === 'string' && name.trim()) : [];
    };
    // A feature's switch: the command's own ctx.feature, else the host's (hook), else its default.
    const featureOn = (id, ctx = null) => {
        if (typeof ctx?.feature === 'function') {
            try {
                const answer = ctx.feature(id);
                if (typeof answer === 'boolean') return answer;
            } catch { /* the host's default below */ }
        }
        const answer = call(hooks.feature, undefined, id);
        return typeof answer === 'boolean' ? answer : FEATURE_DEFAULTS[id] === true;
    };
    const catalog = ctx => {
        if (!featureOn(FEATURE_PRESETS, ctx)) return [];
        const value = call(hooks.presets, null);
        return Array.isArray(value) ? value : BUILT_IN_PRESETS;
    };
    const normalized = (raw, ctx = null) => normalizeMeterSettings(raw, { presets: catalog(ctx), stagesOn: featureOn(FEATURE_STAGES, ctx) });
    const storedSettings = () => normalized(call(hooks.settings, {}));
    const defsFrom = settings => meterDefs(settings, baseline());
    // A reader's action at the top (a button, a screen, a pack): cause ui and no calling module.
    const readerAction = ctx => ctx.cause === 'ui' && !ctx.caller;
    const ownOrModule = (ctx, type, payload) => !readerAction(ctx) || call(hooks.ownCommand, false, type, payload) === true;
    const headReply = () => {
        const value = call(hooks.headReply, null);
        return isInt(value) && value >= 0 ? value : null;
    };
    // The window key for a command about the reply at `index` (Delta's scan of it, the reader's values):
    // the record ID Story Block gives the reply the command is stored on (`ctx.reply`) when that is the
    // reply meant, else the index (replyKey).
    const commandReply = (ctx, index) => replyKey(isInt(index) && ctx?.reply?.index === index ? ctx.reply.sid : null, index);
    // The NPC's meter setup from the dossier (track, limits) and what it means with these settings.
    const setupFor = (name, labels = []) => {
        const value = call(hooks.setup, null, name, labels);
        return { track: clean(value?.track, TRACK_MAX), limits: normalizeLimits(value?.limits), rungs: ownRungs(value?.ladder) };
    };
    // A person's own stage ladder (the cast's `stages`, kept on the dossier): rows as the settings' ladder rows, in order. It stands
    // before any track and only while the stage ladders feature is on (settings.stagesOn).
    const ownRungs = rows => {
        const out = [];
        for (const row of Array.isArray(rows) ? rows : []) {
            const step = rung(row);
            if (step && out.length < MAX_RUNGS && !out.some(other => other.key === step.key)) out.push(step);
        }
        return out;
    };
    const rungsFor = (settings, setup) => {
        if (setup.rungs?.length && settings.stagesOn) return setup.rungs;
        return setup.track && Object.hasOwn(settings.ladder, setup.track) ? settings.ladder[setup.track] : settings.ladder[''] ?? [];
    };
    const limitsFor = (settings, setup) => {
        const merged = { ...(setup.track && Object.hasOwn(settings.limits, setup.track) ? settings.limits[setup.track] : {}) };
        for (const [meter, limit] of Object.entries(setup.limits)) merged[meter] = limit;
        return merged;
    };


    return {
        call, resolve, baseline, tierCaps, rulesFor, presentNames, featureOn, catalog, normalized,
        storedSettings, tierAllowance, clockDay, clockMinutes, dateOf, timeMinutes, defsFrom, readerAction, ownOrModule, headReply, commandReply, setupFor,
        ownRungs, rungsFor, limitsFor,
    };
}
