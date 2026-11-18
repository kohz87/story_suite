// The job: the reference index of a pack: which ids it defines, and every place that names one (the Studio's "Used by", its id pickers,
// the event graph's edges and rename). It reads the author's raw text (paths point into `doc.doc`, below the pack's top, so `edits.apply` takes them),
// and reads one-line strings with the validator's own parsers (`parseCondition`, `parseEntry`, `parseWeight`, the gate joins), never its own copy of them.
//
// buildRefs(doc, other?) → { defs: { <kind>: [{ id, name, path, rec }] }, uses: [use] }. `doc` is a Studio document or a plain pack; `other` is the other open
// pack (a game pack's `content.names.<culture>.regions` name this world's regions); its uses carry `pack: 'other'`. Kinds: place, region, realm, route, cast,
// condition, event, template, power, score, lore, fact. A use is { kind, id, role, path, form, mode?, by, rec, owner } where `form` is 'value' (the whole string
// at `path` is the id), 'text' (the id is inside the grammar string at `path`, read as `mode`) or 'key' (the id is the key at `path`'s end); `by` is 'id' or
// 'name' (a place, region, realm or route may be named by its display name or alias); role 'id' is the definition itself; `dangling` marks an id nothing defines.
// usedBy(refs, kind, id) → the uses that are not the definition. definedIds(refs, kind) → [{ id, name }] in file order, for pickers.
// walkText(text, mode, visit) → the text with each id `visit(hint, id)` answers for replaced (only that span; the rest of the text is kept as written).
//
// This is a navigation map (which fields hold ids), not an allow-list: what a field may hold is the validator's.

import { foldKey } from '../../core/text.js';
import { JOIN } from '../../packs/validate/world-pack-parts/gate.js';
import { parseCondition, parseEntry } from '../../packs/validate/world-pack-parts/grammar.js';
import { parseWeight } from '../../packs/validate/world-pack-parts/weight.js';

const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const ANY = ['place', 'region', 'realm', 'route'];
const dash = text => foldKey(String(text).replace(/[–—]/g, '-'));
const routeKey = route => route.name ?? `${route.from}–${route.to}`;

// ---- one-line strings -------------------------------------------------------------------------------------------------------------------------------

function condition(raw, visit) {
    const found = parseCondition(raw);
    if (found.error) return raw;
    const name = visit('condition', found.name) ?? found.name;
    const ref = found.placeholder ? found.ref : visit('any', found.ref) ?? found.ref;
    return name === found.name && ref === found.ref ? raw : `${name}@${ref}${found.duration === null ? '' : `: ${found.duration}`}`;
}

const HEADS = { fired: 'event', ended: 'event', lapsed: 'event', stage: 'event', died: 'cast', departed: 'cast', fact: 'fact' };

function entry(raw, visit) {
    const found = parseEntry(raw);
    if (found.error) return raw;
    const text = raw.trim();
    if (found.type === 'threshold') return text.replace(/^((?:power|score):\s*)(\S.*?)(\s*(?:>=|<=|>|<|==|=)\s*-?\d+(?:\.\d+)?)$/, (all, head, id, rest) => `${head}${visit(found.kind, id) ?? id}${rest}`);
    if (found.type === 'condition') return condition(text, visit);
    const plus = text.lastIndexOf(' + ');
    const head = plus < 0 ? text : text.slice(0, plus);
    const tail = plus < 0 ? '' : text.slice(plus);
    const body = head.slice(head.indexOf(':') + 1).trim();
    let next;
    if (found.kind === 'set' || found.kind === 'cleared') {
        const [name, ...rest] = body.split('@');
        const ref = rest.join('@');
        next = `${visit('condition', name) ?? name}${rest.length ? `@${visit('any', ref) ?? ref}` : ''}`;
    } else if (found.kind === 'arc-ended') {
        const [name, ...rest] = body.split('@');
        const ref = rest.join('@');
        next = `${visit('template', name) ?? name}${rest.length ? `@${visit('any', ref) ?? ref}` : ''}`;
    } else if (found.kind === 'learned') {
        const cut = body.indexOf('/');
        const who = cut < 0 ? body : body.slice(0, cut);
        const what = cut < 0 ? '' : body.slice(cut);
        next = who === 'lore' ? `lore/${visit('lore', body.slice(5)) ?? body.slice(5)}` : `${visit('cast', who) ?? who}${what}`;
    } else if (HEADS[found.kind]) next = visit(HEADS[found.kind], body) ?? body;
    else return raw;
    return next === body ? raw : `${found.kind}:${next}${tail}`;
}

function weight(raw, visit) {
    if (typeof raw !== 'string' || parseWeight(raw).error) return raw;
    const parts = raw.trim().split(/\s+([+-])\s+/);
    let changed = false;
    for (let at = 0; at < parts.length; at += 2) {
        const found = /^(power|score|standing):\s*(\S.*)$/.exec(parts[at].trim());
        const next = found && visit(found[1], found[2]);
        if (next !== undefined && next !== null) { parts[at] = `${found[1]}:${next}`; changed = true; }
    }
    return changed ? parts.map((part, at) => (at % 2 ? ` ${part} ` : part)).join('') : raw;
}

function gate(raw, visit) {
    const pieces = raw.split(new RegExp(`(${JOIN.source})`));
    let changed = false;
    for (let at = 0; at < pieces.length; at += 2) {
        const part = pieces[at].trim();
        let next = part;
        if (part.startsWith('place:')) next = `place:${visit('place', part.slice(6).trim()) ?? part.slice(6).trim()}`;
        else if (/^(?:stage|meter)\b/.test(part)) next = part.replace(/\bof ([a-z0-9-]+)/, (all, id) => `of ${visit('cast', id) ?? id}`);
        else if (!part.startsWith('quote:')) next = entry(part, visit);
        if (next !== part) { pieces[at] = next; changed = true; }
    }
    return changed ? pieces.join('') : raw;
}

const MODES = { cond: condition, entry, weight, gate };

/** Walks the ids in a one-line string. `mode`: 'cond', 'entry' (a requires-style entry or an anchor), 'weight' or 'gate'. `visit(hint, id)` → a new id or undefined. */
export function walkText(text, mode, visit) {
    return typeof text === 'string' && MODES[mode] ? MODES[mode](text, visit) : text;
}

// ---- where ids sit ----------------------------------------------------------------------------------------------------------------------------------
// Row: [path below the pack's top, role, how]. A path segment `x[]` walks a list, `*` an object's keys. How: `=kind` the id itself, `^kind` the object's keys are
// ids of that kind (`^~entry`: keys are one-line entries), `~mode` a one-line string, else the kind (or 'any' / 'standing') the string names.

const under = (prefix, rows) => rows.map(([path, ...rest]) => [`${prefix}.${path}`, ...rest]);
const EFFECTS = [['set[]', 'set', '~cond'], ['clear[]', 'clear', '~cond'], ['cast[].who', 'cast', 'cast'], ['cast[].location', 'to', 'place'], ['cast[].from', 'from', 'place'], ['cast[].until', 'until', '~entry'], ['powers', 'power', '^power'], ['scores', 'score', '^score'], ['facts[].id', 'id', '=fact']];
const ODDS = [['likelier_if', 'likelier', '^~entry'], ['less_if', 'less', '^~entry']];
const ROWS = [
    ...under('content.places[]', [['id', 'id', '=place'], ['region', 'region', 'region']]),
    ...under('content.routes[]', [['name', 'id', '=route'], ['from', 'from', 'place'], ['to', 'to', 'place']]),
    ...under('content.regions[]', [['id', 'id', '=region']]),
    ...under('content.realms[]', [['id', 'id', '=realm'], ['regions[]', 'region', 'region']]),
    ...under('content.cast[]', [['id', 'id', '=cast'], ['start.place', 'start', 'place'], ['homeBase', 'start', 'place'], ['ties[].with', 'tie', 'cast'], ['keyRelationships[].id', 'bond', 'cast'], ['secrets[].gate', 'gate', '~gate'], ['secrets[].writes_fact', 'id', '=fact']]),
    ...under('content.lore[]', [['id', 'id', '=lore'], ['gate', 'gate', '~gate']]),
    ...under('content.powers[]', [['id', 'id', '=power'], ['holds[]', 'holds', 'place']]),
    ...under('content.scores[]', [['id', 'id', '=score']]),
    ...under('content.conditions[]', [['name', 'id', '=condition']]),
    ...under('content.worldEvents[]', [['id', 'id', '=event'], ['where[]', 'where', 'any'], ['where.region', 'where', 'region'], ['where.realm', 'where', 'realm'], ['requires[]', 'requires', '~entry'], ['requires_any[]', 'requires', '~entry'],
        ['on', 'on', '~entry'], ['window.after', 'after', '~entry'], ['pre_empted_by[]', 'pre-empt', '~entry'], ['ends_when.any_of[]', 'ends', '~entry'], ['outcomes[].weight', 'weight', '~weight'], ...ODDS,
        ...under('effects', EFFECTS), ...under('effects.on_end', EFFECTS), ...under('outcomes[].effects', EFFECTS), ...under('outcomes[].effects.on_end', EFFECTS)]),
    ...under('content.templates[]', [['template', 'id', '=template'], ['needs[]', 'needs', '~entry'], ['requires[]', 'requires', '~entry'], ['requires_any[]', 'requires', '~entry'], ...ODDS, ['sets[]', 'set', '~cond'], ['clears[]', 'clear', '~cond'],
        ['fallback.sets[]', 'set', '~cond'], ['fallback.clears[]', 'clear', '~cond'], ['open.menu.powers.of[]', 'menu', 'power'], ['open.menu.scores.of[]', 'menu', 'score'], ['open.menu.set.of[]', 'menu', 'condition'],
        ['open.menu.clear.of[]', 'menu', 'condition'], ['open.menu.ladder.of[]', 'menu', 'condition'], ['open.menu.cast.of[]', 'menu', 'cast'], ['open.menu.cast.move', 'menu', 'any'], ['open.writes_facts[]', 'id', '=fact']]),
    ...[['world.set[]', 'set', '~cond'], ['world.facts[]', 'id', '=fact'], ['place', 'start', 'place'], ['scene.place.region', 'region', 'region']].flatMap(([path, ...rest]) => [[`content.start.${path}`, ...rest], [`start.${path}`, ...rest]]),
    ['content.names.*.regions[]', 'names', 'region'],
];
const OTHER_ROWS = [['content.names.*.regions[]', 'names', 'region']];

function eachAt(node, segs, path, leaf) {
    if (!segs.length) return leaf(node, path);
    const [seg, ...rest] = segs;
    if (seg === '*') { if (isObj(node)) for (const key of Object.keys(node)) eachAt(node[key], rest, [...path, key], leaf); return undefined; }
    const list = seg.endsWith('[]');
    const key = list ? seg.slice(0, -2) : seg;
    const child = isObj(node) ? node[key] : undefined;
    if (child === undefined) return undefined;
    if (!list) return eachAt(child, rest, [...path, key], leaf);
    if (Array.isArray(child)) child.forEach((item, at) => eachAt(item, rest, [...path, key, at], leaf));
    return undefined;
}

const getAt = (root, path) => path.reduce((node, key) => (node !== null && typeof node === 'object' ? node[key] : undefined), root);
const packOf = doc => (isObj(doc?.doc) ? doc.doc : isObj(doc) ? doc : {});

function ownerOf(pack, path) {
    const at = path[0] === 'content' ? 1 : 0;
    const part = path[at];
    const index = typeof path[at + 1] === 'number' ? path[at + 1] : null;
    const record = index === null ? null : getAt(pack, path.slice(0, at + 2));
    const id = isObj(record) ? record.id ?? record.name ?? record.template ?? null : null;
    return { rec: index === null ? part : `${part}.${index}`, owner: { part, index, id: typeof id === 'string' ? id : null } };
}

/** Reads a pack (a Studio document or a plain pack) → { defs, uses }. See the top of the file. */
export function buildRefs(doc, other = null) {
    const pack = packOf(doc);
    const defs = new Map(ANY.concat(['cast', 'condition', 'event', 'template', 'power', 'score', 'lore', 'fact']).map(kind => [kind, new Map()]));
    const names = new Map();
    const uses = [];
    const addDef = (kind, id, path, record) => {
        const found = [record?.name, ...(Array.isArray(record?.aliases) ? record.aliases : [])].filter(text => typeof text === 'string' && text.trim());
        if (!defs.get(kind).has(id)) defs.get(kind).set(id, { id, name: typeof record?.name === 'string' ? record.name : id, path, ...(path ? ownerOf(pack, path) : {}) });
        if (kind === 'route') names.set(dash(id), [...(names.get(dash(id)) ?? []), { kind, id }]);
        else if (['place', 'region', 'realm'].includes(kind)) for (const text of found) names.set(foldKey(text), [...(names.get(foldKey(text)) ?? []), { kind, id }]);
    };
    const resolve = (hint, id) => {
        if (hint === 'standing') return [{ kind: defs.get('power').has(id) ? 'power' : 'score', id, by: 'id', dangling: !defs.get('power').has(id) && !defs.get('score').has(id) }];
        const kinds = hint === 'any' ? ANY : [hint];
        const byId = kinds.filter(kind => defs.get(kind)?.has(id)).map(kind => ({ kind, id, by: 'id' }));
        if (byId.length) return byId;
        const key = kinds.includes('route') ? dash(id) : foldKey(id);
        const byName = (names.get(key) ?? names.get(foldKey(id)) ?? []).filter(item => kinds.includes(item.kind)).map(item => ({ ...item, by: 'name' }));
        if (byName.length) return byName;
        return hint === 'any' || id === 'anywhere' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(id)) ? [] : [{ kind: hint, id, by: 'id', dangling: true }];
    };
    const run = (root, rows, phase, extra) => {
        for (const [row, role, how] of rows) {
            if ((how[0] === '=') !== (phase === 'defs')) continue;
            eachAt(root, row.split('.'), [], (node, path) => {
                const place = ownerOf(root, path);
                const note = (use) => uses.push({ role, path, form: 'value', ...place, ...extra, ...use });
                if (how[0] === '=') {
                    if (typeof node !== 'string' || !node) return;
                    addDef(how.slice(1), node, path, getAt(root, path.slice(0, -1)));
                    return note({ kind: how.slice(1), id: node, by: 'id' });
                }
                if (how[0] === '^') {
                    if (!isObj(node)) return;
                    for (const key of Object.keys(node)) {
                        if (how[1] === '~') walkText(key, how.slice(2), (hint, id) => { for (const found of resolve(hint, id)) note({ ...found, path: [...path, key], form: 'key', mode: how.slice(2) }); });
                        else note({ kind: how.slice(1), id: key, by: 'id', path: [...path, key], form: 'key', ...(defs.get(how.slice(1)).has(key) ? {} : { dangling: true }) });
                    }
                    return;
                }
                if (typeof node !== 'string') return;
                if (how[0] === '~') walkText(node, how.slice(1), (hint, id) => { for (const found of resolve(hint, id)) note({ ...found, form: 'text', mode: how.slice(1) }); });
                else for (const found of resolve(how, node)) note(found);
            });
        }
    };
    run(pack, ROWS, 'defs', {});
    for (const route of Array.isArray(pack.content?.routes) ? pack.content.routes : []) if (isObj(route) && route.name === undefined && typeof route.from === 'string' && typeof route.to === 'string') addDef('route', routeKey(route), null, null);
    run(pack, ROWS, 'uses', {});
    if (other) run(packOf(other), OTHER_ROWS, 'uses', { pack: 'other' });
    return { defs: Object.fromEntries([...defs].map(([kind, map]) => [kind, [...map.values()]])), uses };
}

/** The uses of one id (not its definition). */
export const usedBy = (refs, kind, id) => (refs?.uses ?? []).filter(use => use.kind === kind && use.id === id && use.role !== 'id');

/** The ids of one kind, in file order, for pickers: [{ id, name }]. */
export const definedIds = (refs, kind) => (refs?.defs?.[kind] ?? []).map(({ id, name }) => ({ id, name }));
