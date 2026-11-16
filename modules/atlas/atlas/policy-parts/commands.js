// Player commands for managing atlas regions, place bindings, and area danger policies.

import { REGION_ID, MAX_ALIASES, MAX_NAME, MAX_REGIONS, PLACE_ID, areaPolicyProblems, cleanName, findPlace, isRecord, keyOf } from '../domain.js';
import { canonicalOf, candidatesOf } from '../canonical.js';
import { packWorld } from '../world.js';
import { WRITE_ID, fingerprintOf, idFrom, remember, retryOf } from '../../../world/writes.js';
import { policyProjection } from './projection.js';

const HASH = /^[0-9a-f]{64}$/;
const queryOf = ctx => (typeof ctx?.query === 'function' ? (name, args) => ctx.query(name, args) : null);
const isPlayer = ctx => ctx.cause === 'ui' && !ctx.caller;

const FIELDS = {
    'atlas.region': ['write', 'id', 'name', 'aliases', 'expectedHash'],
    'atlas.placeRegion': ['write', 'place', 'region', 'expectedHash'],
    'atlas.dangerSet': ['write', 'scope', 'key', 'policy', 'expectedHash'],
    'atlas.placeBind': ['write', 'place', 'definition', 'expectedHash'],
};

function opened(ctx, type, payload) {
    if (!isRecord(payload)) ctx.fail('INVALID', `${type} takes an object.`);
    const extra = Object.keys(payload).find(key => !FIELDS[type].includes(key));
    if (extra) ctx.fail('INVALID', `${type} does not take "${extra}".`);
    if (!WRITE_ID.test(payload.write ?? '')) ctx.fail('INVALID', `${type} needs the id of the write that asks for it.`);
    if (!HASH.test(payload.expectedHash ?? '')) ctx.fail('INVALID', `${type} needs the hash of the policy it was made on.`);
    return payload;
}

/** After the shape: the player's own setting, then a retry of the same write (its saved answer), else the fingerprint to record. */
function gate(ctx, type, payload) {
    if (!isPlayer(ctx)) ctx.fail('REFUSED', `${type} is the player's own setting; the story and other modules cannot make it.`);
    const fingerprint = fingerprintOf(type, payload);
    const retry = retryOf(ctx.read('atlas').writes ?? {}, payload.write, fingerprint);
    if (retry?.conflict) ctx.fail('CONFLICT', 'That write was already made with another meaning.');
    return { fingerprint, saved: retry?.result ?? null };
}

const saved = (type, result, key) => ({ summary: '', narrate: false, data: { v2: { key: `${type}:${key}`, result } } });

function commit(ctx, type, payload, fingerprint, result, key) {
    const atlas = ctx.draft('atlas');
    atlas.writes ??= {};
    remember(atlas.writes, payload.write, fingerprint, result);
    return saved(type, result, key);
}

function stale(ctx, payload) {
    if (policyProjection(ctx.read('atlas')).hash !== payload.expectedHash) ctx.fail('STALE', 'The map settings changed since they were read.');
}

/** Normalized names a region goes by: its name and every alias, each once. */
const namesOf = (name, aliases) => [name, ...aliases].map(keyOf);

function region(ctx, raw) {
    const payload = opened(ctx, 'atlas.region', raw);
    const name = cleanName(payload.name);
    if (!keyOf(name)) ctx.fail('INVALID', 'A region has a name.');
    const aliasList = payload.aliases === undefined ? [] : payload.aliases;
    if (!Array.isArray(aliasList) || aliasList.length > MAX_ALIASES) ctx.fail('INVALID', `A region has at most ${MAX_ALIASES} aliases.`);
    const aliases = aliasList.map(alias => (typeof alias === 'string' ? cleanName(alias) : ''));
    if (aliases.some(alias => !keyOf(alias) || alias.length > MAX_NAME)) ctx.fail('INVALID', 'An alias is a name of at most 80 characters.');
    if (new Set(namesOf(name, aliases)).size !== aliases.length + 1) ctx.fail('INVALID', 'A region\'s name and aliases are different from each other.');
    if (payload.id !== undefined && !REGION_ID.test(payload.id)) ctx.fail('INVALID', 'A region id looks like rg_k3f9a2qz.');
    const { fingerprint, saved: again } = gate(ctx, 'atlas.region', payload);
    if (again) return saved('atlas.region', again, again.region);
    const atlas = ctx.read('atlas');
    const regions = atlas.regions ?? {};
    if (payload.id !== undefined && !Object.hasOwn(regions, payload.id)) ctx.fail('NOT_FOUND', 'That region is not there.');
    stale(ctx, payload);
    for (const [id, other] of Object.entries(regions)) {
        if (id === payload.id) continue;
        const taken = new Set(namesOf(other.name, other.aliases));
        if (namesOf(name, aliases).some(key => taken.has(key))) ctx.fail('CONFLICT', `"${other.name}" already goes by one of those names.`);
    }
    if (payload.id === undefined && Object.keys(regions).length >= MAX_REGIONS) ctx.fail('LIMITED', `There are at most ${MAX_REGIONS} regions.`);
    const draft = ctx.draft('atlas');
    draft.regions ??= {};
    const id = payload.id ?? idFrom(ctx, 'rg', draft.regions);
    draft.regions[id] = { id, name, aliases };
    return commit(ctx, 'atlas.region', payload, fingerprint, { region: id, hash: policyProjection(draft).hash }, id);
}

/** The canonical place a writer means, or why not: NOT_FOUND for an unknown ref, CONFLICT for a held (ambiguous) one. */
function canonicalFor(ctx, ref) {
    if (typeof ref !== 'string' || !ref.trim()) ctx.fail('INVALID', 'Name the place.');
    const atlas = ctx.read('atlas');
    const pack = packWorld(queryOf(ctx));
    const canonical = canonicalOf(atlas, pack, ref);
    if (canonical) return canonical;
    if (findPlace(atlas, ref)) ctx.fail('CONFLICT', 'That place fits more than one pack place; bind it to one first.');
    ctx.fail('NOT_FOUND', 'No such place.');
    return null;
}

function placeRegion(ctx, raw) {
    const payload = opened(ctx, 'atlas.placeRegion', raw);
    if (!(payload.region === null || REGION_ID.test(payload.region ?? ''))) ctx.fail('INVALID', 'region is a region id like rg_k3f9a2qz, or null.');
    const { fingerprint, saved: again } = gate(ctx, 'atlas.placeRegion', payload);
    if (again) return saved('atlas.placeRegion', again, again.place);
    const canonical = canonicalFor(ctx, payload.place);
    if (payload.region !== null && !Object.hasOwn(ctx.read('atlas').regions ?? {}, payload.region)) ctx.fail('NOT_FOUND', 'That region is not there.');
    stale(ctx, payload);
    const draft = ctx.draft('atlas');
    draft.placeRegions ??= {};
    if (payload.region === null) delete draft.placeRegions[canonical.id];
    else draft.placeRegions[canonical.id] = payload.region;
    return commit(ctx, 'atlas.placeRegion', payload, fingerprint, { place: canonical.id, region: payload.region, hash: policyProjection(draft).hash }, canonical.id);
}

function dangerSet(ctx, raw) {
    const payload = opened(ctx, 'atlas.dangerSet', raw);
    if (!['world', 'region', 'place'].includes(payload.scope)) ctx.fail('INVALID', 'scope is world, region or place.');
    if (payload.scope === 'world' ? payload.key !== null : typeof payload.key !== 'string' || !payload.key) ctx.fail('INVALID', payload.scope === 'world' ? 'The world has no key (null).' : `A ${payload.scope} policy needs its key.`);
    if (!Object.hasOwn(payload, 'policy')) ctx.fail('INVALID', 'atlas.dangerSet needs a policy, or null to remove one.');
    if (payload.policy !== null) {
        const problems = areaPolicyProblems(payload.policy, 'policy');
        if (problems.length) ctx.fail('INVALID', problems[0]);
    }
    const { fingerprint, saved: again } = gate(ctx, 'atlas.dangerSet', payload);
    if (again) return saved('atlas.dangerSet', again, again.key ?? 'world');
    let key = payload.key;
    if (payload.scope === 'region' && !Object.hasOwn(ctx.read('atlas').regions ?? {}, key)) ctx.fail('NOT_FOUND', 'That region is not there.');
    if (payload.scope === 'place') key = canonicalFor(ctx, key).id;
    stale(ctx, payload);
    const draft = ctx.draft('atlas');
    draft.danger ??= { world: null, regions: {}, places: {} };
    if (payload.scope === 'world') draft.danger.world = payload.policy === null ? null : structuredClone(payload.policy);
    else {
        const table = payload.scope === 'region' ? draft.danger.regions : draft.danger.places;
        if (payload.policy === null) delete table[key];
        else table[key] = structuredClone(payload.policy);
    }
    return commit(ctx, 'atlas.dangerSet', payload, fingerprint, { scope: payload.scope, key, hash: policyProjection(draft).hash }, key ?? 'world');
}

function placeBind(ctx, raw) {
    const payload = opened(ctx, 'atlas.placeBind', raw);
    if (!PLACE_ID.test(payload.place ?? '')) ctx.fail('INVALID', 'place is a place id like pl_k3f9a2qz.');
    if (typeof payload.definition !== 'string' || !payload.definition) ctx.fail('INVALID', 'Name the pack place (pack.<id>/<slug>).');
    const { fingerprint, saved: again } = gate(ctx, 'atlas.placeBind', payload);
    if (again) return saved('atlas.placeBind', again, again.place);
    const atlas = ctx.read('atlas');
    const own = Object.hasOwn(atlas.places, payload.place) ? atlas.places[payload.place] : null;
    if (!own) ctx.fail('NOT_FOUND', 'That place is not on the map.');
    const pack = packWorld(queryOf(ctx));
    if (!(pack.candidates ?? []).some(candidate => candidate.id === payload.definition)) ctx.fail('NOT_FOUND', 'No pack has such a place.');
    stale(ctx, payload);
    const refs = atlas.placeRefs ?? {};
    // An identity once established never changes; a definition belongs to one place; a bind must fit the place's names.
    if (refs[own.id] && refs[own.id] !== payload.definition) ctx.fail('CONFLICT', 'That place already has its identity.');
    if (Object.entries(refs).some(([id, target]) => target === payload.definition && id !== own.id)) ctx.fail('CONFLICT', 'That pack place is already another place.');
    if (!candidatesOf(atlas, pack, own).some(candidate => candidate.id === payload.definition)) ctx.fail('CONFLICT', 'That pack place does not match this place\'s names.');
    const draft = ctx.draft('atlas');
    draft.placeRefs ??= {};
    draft.placeRefs[own.id] = payload.definition;
    return commit(ctx, 'atlas.placeBind', payload, fingerprint, { place: own.id, definition: payload.definition, hash: policyProjection(draft).hash }, own.id);
}

export const commands = { 'atlas.region': region, 'atlas.placeRegion': placeRegion, 'atlas.dangerSet': dangerSet, 'atlas.placeBind': placeBind };
