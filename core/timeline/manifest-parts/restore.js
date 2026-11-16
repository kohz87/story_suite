// Planning a restore: the ops that install a saved payload absolutely, and the manifest of where each domain came from.

import { apply, checkOps, escapeKey } from '../../ops.js';
import { hashJson } from '../../replay.js';
import { GENESIS_EPOCH, HOST_DOMAIN } from '../gate.js';
import { fail, isObject } from '../util.js';
import { domainDef, registered, versionOf } from './domains.js';
import { payloadProblem } from './payload.js';
import { SCHEMA, initialSavepoints, previousDayOf, savepointsProblems } from './savepoints.js';

/**
 * Plans a restore: the ops that install the payload of `entry` on `state` absolutely, and the manifest that says where each
 * domain came from. → `{ ok: true, ops, manifest, manifestHash, next }` or a failure (`SNAPSHOT_UNAVAILABLE` for bytes,
 * versions or slices that cannot be used). Nothing is applied.
 * * every captured domain is installed as saved (`add` at the domain: whatever is there is replaced, and a domain that is
 *   not there yet is made, so replaying the block on another state gives the same slice, never a difference);
 * * a domain saved at an older version goes through its definition's `migrate(slice, { from, to })`; one saved by a newer
 *   version cannot be used;
 * * a registered domain the state holds and the payload does not (it came after the save) is brought to its definition's
 *   `absent()` slice; without one the restore cannot be done. An unregistered domain the payload lacks is removed: nothing
 *   after the save is kept;
 * * the story claims go back to the saved set and the proof pins to the saved pins (the proof of the faded story is no
 *   longer active); a saved pin the story no longer has cannot be put back;
 * * the savepoints domain is the saved one, in the new epoch, with the selected point's descriptor and the return added
 *   (earlier returns stay: they are the audit);
 * * every registered validator is asked of the result, and each must pass.
 */
export function planRestore({ registry, state, entry, descriptor, returnRecord, newEpoch, deathEvents, batchResult }) {
    const payload = entry?.payload;
    const bad = payloadProblem(payload);
    if (bad) return fail('SNAPSHOT_UNAVAILABLE', `The save point's bytes cannot be used: ${bad}.`);
    // The proof pins the story held are part of what the save is (its payloadHash covers them): bytes without them are not bytes.
    if (!isObject(entry.proofs)) return fail('SNAPSHOT_UNAVAILABLE', 'The save point\'s proof pins are missing from its bytes.');
    const pins = entry.proofs;
    const ops = [];
    const listing = {};
    const have = isObject(state?.domains) ? state.domains : {};
    // Every domain there is: the registry's (whether or not the state holds it), the state's and the save's.
    const names = [...new Set([...registered(registry).map(item => item.name), ...Object.keys(payload.domains), ...Object.keys(have)])].filter(name => name !== HOST_DOMAIN).sort();
    for (const name of names) {
        const path = `/domains/${escapeKey(name)}`;
        const def = domainDef(registry, name);
        const saved = Object.hasOwn(payload.domains, name);
        const here = Object.hasOwn(have, name);
        const now = versionOf(def);
        if (saved) {
            let slice = payload.domains[name];
            let from = Number.isInteger(payload.domainVersions[name]) && payload.domainVersions[name] >= 1 ? payload.domainVersions[name] : 1;
            let source = def ? 'saved' : 'orphan';
            if (def && from > now) return fail('SNAPSHOT_UNAVAILABLE', `The domain ${name} was saved by a newer version (${from}) than this one reads (${now}).`);
            if (def && from < now) {
                if (typeof def.migrate !== 'function') return fail('SNAPSHOT_UNAVAILABLE', `The domain ${name} was saved at version ${from}, this is ${now}, and it has no migrate() to bring the save forward.`);
                try { slice = def.migrate(structuredClone(slice), { from, to: now }); } catch (error) {
                    return fail('SNAPSHOT_UNAVAILABLE', `The domain ${name} could not be migrated from version ${from}: ${error?.message ?? error}`);
                }
                if (!isObject(slice)) return fail('SNAPSHOT_UNAVAILABLE', `The migration of the domain ${name} gave no record.`);
                source = 'migrated';
            } else if (!def) from = Number.isInteger(from) ? from : 1;
            ops.push({ op: 'add', path, value: structuredClone(slice) });
            listing[name] = { version: def ? now : from, source, hash: hashJson(slice) };
        } else if (def || here) {
            if (def?.deferred === true && def.snapshot === 'when-present') {
                if (here) { ops.push({ op: 'remove', path }); listing[name] = { version: now, source: 'removed', hash: null }; }
                continue;
            }
            if (def) {
                if (typeof def.absent !== 'function') return fail('SNAPSHOT_UNAVAILABLE', `The domain ${name} came after this save and says nothing of how to restore without it (no absent() on its definition).`);
                let slice;
                try { slice = def.absent(); } catch (error) { return fail('SNAPSHOT_UNAVAILABLE', `The default of the domain ${name} could not be made: ${error?.message ?? error}`); }
                if (!isObject(slice)) return fail('SNAPSHOT_UNAVAILABLE', `The default of the domain ${name} is no record.`);
                ops.push({ op: 'add', path, value: structuredClone(slice) });
                listing[name] = { version: now, source: 'default', hash: hashJson(slice) };
            } else {
                ops.push({ op: 'remove', path });
                listing[name] = { version: 1, source: 'removed', hash: null };
            }
        }
    }

    // The savepoints domain: the saved one, in the new epoch, with the selected point and the return.
    const base = isObject(payload.domains[HOST_DOMAIN]) ? structuredClone(payload.domains[HOST_DOMAIN]) : initialSavepoints();
    const earlier = isObject(have[HOST_DOMAIN]?.returns) ? have[HOST_DOMAIN].returns : {};
    const points = { ...(isObject(base.points) ? base.points : {}), [descriptor.id]: structuredClone(descriptor) };
    // The save was captured before its own descriptor existed, so the anchor index lacks its entry: it is overlaid, and the
    // start of the previous day is worked out again from the index (an entry whose point is not there goes).
    const dayStarts = Object.fromEntries(Object.entries(isObject(base.dayStarts) ? base.dayStarts : {}).filter(([, id]) => Object.hasOwn(points, id)));
    if (descriptor.kind === 'day-start' && Number.isSafeInteger(descriptor.day)) dayStarts[String(descriptor.day)] = descriptor.id;
    const host = {
        schema: SCHEMA, epoch: newEpoch, points, dayStarts, previousDay: previousDayOf(dayStarts),
        returns: { ...structuredClone(earlier), [returnRecord.id]: structuredClone(returnRecord) },
        // The rule settings the save was made under become the chat's (the overlay modules read in preference to the global ones).
        ruleSettings: structuredClone(payload.effectiveSettings),
    };
    ops.push({ op: 'add', path: `/domains/${escapeKey(HOST_DOMAIN)}`, value: host });
    listing[HOST_DOMAIN] = { version: 1, source: 'host', hash: hashJson(host) };

    // Story claims back to the saved set: the ones the faded story made go, the saved ones the story lacks are put back.
    const claims = isObject(state?.meta?.claims) ? state.meta.claims : null;
    const saved = Object.keys(payload.storyClaims).sort();
    if (claims === null) {
        if (saved.length) ops.push({ op: 'add', path: '/meta/claims', value: Object.fromEntries(saved.map(key => [key, true])) });
    } else {
        for (const key of Object.keys(claims).sort()) if (!Object.hasOwn(payload.storyClaims, key)) ops.push({ op: 'remove', path: `/meta/claims/${escapeKey(key)}` });
        for (const key of saved) if (!Object.hasOwn(claims, key)) ops.push({ op: 'add', path: `/meta/claims/${escapeKey(key)}`, value: true });
    }

    // Proof pins back to the saved pins: the proof the faded story gave is not active any more.
    const current = isObject(state?.meta?.proofs) ? state.meta.proofs : {};
    for (const id of Object.keys(pins).sort()) {
        if (current[id] !== pins[id]) return fail('SNAPSHOT_UNAVAILABLE', `The proof ${id} the save held is not pinned by the story any more, and a restore cannot give it back.`);
    }
    for (const id of Object.keys(current).sort()) if (!Object.hasOwn(pins, id)) ops.push({ op: 'remove', path: `/meta/proofs/${escapeKey(id)}` });

    // Every registered validator is asked of what the restore would leave.
    let next;
    const all = [...ops, { op: 'replace', path: '/meta/rev', value: (Number.isInteger(state?.meta?.rev) ? state.meta.rev : 0) + 1 }];
    const rules = checkOps(all);
    if (rules.length) return fail('SNAPSHOT_UNAVAILABLE', `The save point breaks the state's generic rules, so it is not restored: ${rules.join(' ')}`);
    try {
        next = apply(state, all);
    } catch (error) {
        return fail('FAILED', `The save could not be installed: ${error?.message ?? error}`);
    }
    const problems = [];
    for (const item of registered(registry)) {
        if (!Object.hasOwn(next.domains, item.name)) continue;
        const validate = registry.validator?.(item.name);
        if (typeof validate !== 'function') continue;
        try {
            const errors = validate(next.domains[item.name], next);
            if (Array.isArray(errors)) problems.push(...errors.map(String));
        } catch (error) {
            problems.push(`The ${item.name} check itself failed: ${error?.message ?? error}`);
        }
    }
    problems.push(...savepointsProblems(next.domains[HOST_DOMAIN]));
    if (problems.length) return fail('SNAPSHOT_UNAVAILABLE', `The save point does not pass today's checks, so it is not restored: ${problems.join(' ')}`);

    const manifest = {
        schema: SCHEMA, snapshot: descriptor.id, payloadHash: descriptor.payloadHash, return: returnRecord.id,
        oldEpoch: state?.domains?.[HOST_DOMAIN]?.epoch ?? GENESIS_EPOCH, newEpoch,
        target: descriptor.target, restoreAt: returnRecord.restoreAt, deathEvents: [...deathEvents], batchResult: { ...batchResult },
        domains: listing, claims: hashJson(payload.storyClaims), proofs: hashJson(pins), settings: hashJson(payload.effectiveSettings),
        participants: [...descriptor.participants].sort((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : 0)),
    };
    return { ok: true, ops, manifest, manifestHash: hashJson(manifest), next };
}
