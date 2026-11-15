// The all-domain payload: capturing it from the state and checking a saved one.

import { HOST_DOMAIN } from '../gate.js';
import { isObject } from '../util.js';
import { domainDef, registered, versionOf } from './domains.js';
import { SCHEMA } from './savepoints.js';

/**
 * The payload of contract §8 for `state`: `{ schema: 2, domains, storyClaims, effectiveSettings, domainVersions,
 * participants }`, with the proof pins the story held beside it (`proofs`), and the manifest of what was found:
 * `{ registered, held, absent, orphans }`. `participants` is left empty: the coordinator fills it from the
 * checkpoints it asks for.
 * * every domain of the state is captured (a registered one, an orphan whose module is gone, the host's savepoints);
 * * a registered domain the state does not hold (not set up yet) is listed as absent and is not invented;
 * * `effectiveSettings`: for each module that names the settings that are rules (`settings.rules`, a list of keys), their
 *   values as they are now.
 */
export function capture({ registry, state, settings = () => ({}) }) {
    const domains = structuredClone(state?.domains ?? {});
    // Opt-in deferred domains leave no snapshot metadata before first use. Other domains keep
    // their existing absent/default contract, including deferred domains without this flag.
    const names = registered(registry).filter(item => domainDef(registry, item.name)?.snapshot !== 'when-present' || Object.hasOwn(domains, item.name));
    const known = new Set(names.map(item => item.name));
    const domainVersions = {};
    for (const name of Object.keys(domains).sort()) domainVersions[name] = versionOf(domainDef(registry, name));
    const effectiveSettings = {};
    for (const def of registry.modules?.() ?? []) {
        const keys = def.settings?.rules;
        if (!Array.isArray(keys) || !keys.length) continue;
        let values = {};
        try { values = settings(def.id) ?? {}; } catch { values = {}; }
        const picked = {};
        for (const key of keys) if (typeof key === 'string' && Object.hasOwn(values, key)) picked[key] = structuredClone(values[key]);
        effectiveSettings[def.id] = picked;
    }
    const claims = isObject(state?.meta?.claims) ? state.meta.claims : {};
    const storyClaims = {};
    for (const key of Object.keys(claims).sort()) storyClaims[key] = true;
    const payload = { schema: SCHEMA, domains, storyClaims, effectiveSettings, domainVersions, participants: [] };
    const proofs = isObject(state?.meta?.proofs) ? structuredClone(state.meta.proofs) : {};
    const manifest = {
        registered: names,
        held: names.filter(item => Object.hasOwn(domains, item.name)).map(item => item.name),
        absent: names.filter(item => !Object.hasOwn(domains, item.name)).map(item => item.name),
        orphans: Object.keys(domains).filter(name => !known.has(name) && name !== HOST_DOMAIN).sort(),
    };
    return { payload, proofs, manifest };
}

/** '' when `payload` is a snapshot payload of this schema, else why not. */
export function payloadProblem(payload) {
    if (!isObject(payload)) return 'the saved payload is not a record';
    if (payload.schema !== SCHEMA) return `the saved payload is schema ${payload.schema}, not ${SCHEMA}`;
    if (!isObject(payload.domains) || Object.values(payload.domains).some(slice => !isObject(slice))) return 'its domains are not records';
    if (!isObject(payload.storyClaims) || !isObject(payload.effectiveSettings) || !isObject(payload.domainVersions)) return 'it lacks its claims, settings or versions';
    if (!Array.isArray(payload.participants)) return 'it lacks its participants';
    return '';
}
