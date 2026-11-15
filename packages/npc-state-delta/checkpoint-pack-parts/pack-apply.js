/* NPC State Delta applying a restricted RFC 6902 patch to a base image by path copying. */
import { PackError } from './pack-constants.js';
import { isObject, setOwn } from './pack-shared.js';

const PATCH_OPS = new Set(['add', 'replace', 'remove']);
const ARRAY_INDEX = /^(0|[1-9]\d*)$/;

function parsePointer(path) {
    if (typeof path !== 'string' || (path !== '' && path[0] !== '/')) throw new PackError('patch path must be a JSON Pointer');
    if (path === '') return [];
    return path.slice(1).split('/').map(token => {
        if (/~(?![01])/.test(token)) throw new PackError('invalid JSON Pointer escape');
        return token.replace(/~1/g, '/').replace(/~0/g, '~');
    });
}

function arrayIndex(array, token) {
    if (!ARRAY_INDEX.test(token) || Number(token) >= array.length) throw new PackError('patch array index is out of range');
    return Number(token);
}

// Walks one token down an existing path. Only own properties count, so "constructor/..." never resolves
// through the prototype chain.
function childOf(container, token) {
    if (Array.isArray(container)) return container[arrayIndex(container, token)];
    if (isObject(container) && Object.hasOwn(container, token)) return container[token];
    throw new PackError('patch path does not exist');
}

function operationValue(op) {
    if (!Object.hasOwn(op, 'value')) throw new PackError('patch operation needs a value');
    return structuredClone(op.value);
}

function applyAt(parent, key, op) {
    const isArray = Array.isArray(parent);
    if (!isArray && !isObject(parent)) throw new PackError('patch parent is not a container');
    if (op.op === 'remove') {
        if (isArray) throw new PackError('patch may not remove an array element');
        if (!Object.hasOwn(parent, key)) throw new PackError('patch removes a missing key');
        delete parent[key];
        return;
    }
    if (isArray) {
        const value = operationValue(op);
        if (op.op === 'add') {
            if (key !== '-') throw new PackError('patch may only append to an array with "-"');
            parent.push(value);
        } else {
            parent[arrayIndex(parent, key)] = value;
        }
        return;
    }
    if (op.op === 'add' && Object.hasOwn(parent, key)) throw new PackError('patch adds a key that already exists');
    if (op.op === 'replace' && !Object.hasOwn(parent, key)) throw new PackError('patch replaces a missing key');
    setOwn(parent, key, operationValue(op));
}

// Copy of a container, made at most once per applyJson call: the walk below copies only the containers on a patched path
// and shares everything else with `base` (never mutated, so sharing is safe). Cost is the patch, not the snapshot.
function ownCopy(container, copied) {
    if (copied.has(container)) return container;
    let copy;
    if (Array.isArray(container)) copy = container.slice();
    else {
        copy = {};
        for (const key of Object.keys(container)) setOwn(copy, key, container[key]);
    }
    copied.add(copy);
    return copy;
}

// Applies a restricted RFC 6902 patch to `base` by path copying. Never mutates its inputs; throws PackError on any
// operation, path or base that the generator would not produce. The result may share unchanged parts with `base`.
export function applyJson(base, ops) {
    if (base === undefined) throw new PackError('patch base is missing');
    if (!Array.isArray(ops)) throw new PackError('patch must be an array');
    const copied = new WeakSet();
    let root = base;
    for (const op of ops) {
        if (!isObject(op) || !PATCH_OPS.has(op.op)) throw new PackError('unsupported patch operation');
        const tokens = parsePointer(op.path);
        if (tokens.length === 0) {
            if (op.op !== 'replace') throw new PackError(`"${op.op}" needs a path`);
            root = operationValue(op);
            if (root !== null && typeof root === 'object') copied.add(root);
            continue;
        }
        if (root === null || typeof root !== 'object') throw new PackError('patch path does not exist');
        root = ownCopy(root, copied);
        let parent = root;
        for (const token of tokens.slice(0, -1)) {
            const child = childOf(parent, token);
            if (child === null || typeof child !== 'object') throw new PackError('patch path does not exist');
            const own = ownCopy(child, copied);
            if (own !== child) {
                if (Array.isArray(parent)) parent[Number(token)] = own;
                else setOwn(parent, token, own);
            }
            parent = own;
        }
        applyAt(parent, tokens[tokens.length - 1], op);
    }
    return root;
}
