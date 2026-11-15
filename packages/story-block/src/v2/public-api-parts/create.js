// Builds the frozen public API object and delivers its events after the store has saved.

import { API_VERSION, API_EVENTS } from './constants.js';
import { deepFreeze } from './shared-basics.js';
import { createReaders } from './readers.js';
import { diffLeaves, summaryOf } from './diff.js';

const LOG = '[Story Block API]';

// The head event's reasons that are announced as `story:rebuilt`.
const REBUILT = new Set(['swipe', 'delete', 'reread', 'repair', 'rewind', 'module']);

/** A frozen plain copy of `value` (JSON data only). */
const frozenCopy = value => (value === undefined ? undefined : deepFreeze(structuredClone(value)));

/**
 * createPublicApi(deps) → the frozen `StoryBlock.api`.
 * deps: { version, hostReady (a promise: the host is up), state() (the head state), before(index) (the state before reply `index`), ask(state, name, args),
 * rpgOn(), persona(), events (the internal createEvents), chatId(), saved() (a promise: what the store holds is written; never rejects), log? }.
 */
export function createPublicApi({ version, hostReady = Promise.resolve(), state, before = () => null, ask, rpgOn, persona, events, chatId = () => '', saved = async () => {}, log = console.warn, publicPaths = null, latestIndex = () => 0 }) {
    const readers = createReaders({ ask, rpgOn, persona });
    // Paths from modules (public-paths.js): read through the same guards as our own; their snapshot (`moduleSnap`) is what the last announcement saw.
    const fromModules = {
        get: path => (publicPaths && publicPaths.owns(path) ? publicPaths.get(path) : undefined),
        paths: () => (publicPaths ? publicPaths.paths() : []),
        leaves: () => (publicPaths ? publicPaths.leaves() : new Map()),
    };
    const headState = () => { try { return state() ?? null; } catch { return null; } };
    const listeners = new Map(API_EVENTS.map(name => [name, new Set()]));
    const told = new WeakSet();
    const heard = names => names.some(name => listeners.get(name).size > 0);

    function deliver(name, payload) {
        const frozen = deepFreeze(payload);
        for (const fn of [...listeners.get(name)]) {
            const failed = error => {
                if (told.has(fn)) return;
                told.add(fn);
                try { log(`${LOG} a "${name}" listener failed (told once)`, error); } catch { /* a missing console is not an error */ }
            };
            try {
                const result = fn(frozen);
                if (result && typeof result.then === 'function') result.then(undefined, failed);
            } catch (error) { failed(error); }
        }
    }
    // Events go out in order, each after the store has written what it holds.
    let chain = Promise.resolve();
    const later = jobs => {
        chain = chain.then(async () => {
            await saved();
            for (const [name, payload] of jobs) deliver(name, payload);
        }).catch(error => { try { log(`${LOG} an event could not be delivered`, error); } catch { /* nothing to tell it to */ } });
    };

    // What the last reply announced, so the lines a safety net adds to it are told as their own change.
    let announced = null;
    const leavesNow = () => new Map([...readers.leaves(headState()), ...fromModules.leaves()]);
    // The module paths' values at the last announcement (null while nobody listens: it is taken when a listener comes).
    let moduleSnap = null;

    function onTurn(turn) {
        if (!heard(['story:changed', 'story:reply'])) { announced = null; moduleSnap = null; return; }
        const type = turn?.type;
        if (type === 'reread' || !Number.isInteger(turn?.index)) return;
        const index = turn.index;
        const now = leavesNow();
        const start = announced?.index === index ? announced.leaves : new Map([...readers.leaves(before(index)), ...(moduleSnap ?? fromModules.leaves())]);
        const changes = diffLeaves(start, now);
        announced = { index, leaves: now };
        moduleSnap = fromModules.leaves();
        const jobs = [];
        if (changes.length) jobs.push(['story:changed', { index, changes }]);
        if (type !== 'late') jobs.push(['story:reply', { index, summary: summaryOf(changes) }]);
        if (jobs.length) later(jobs);
    }

    let lastChat = null;
    let firstRead = null;
    const firstReadDone = new Promise(resolve => { firstRead = resolve; });
    function onHead(info) {
        const reason = info?.reason;
        if (reason === 'chat') {
            const id = (() => { try { return String(chatId() ?? ''); } catch { return ''; } })();
            const same = lastChat !== null && lastChat === id;
            lastChat = id;
            announced = null;
            moduleSnap = heard(['story:changed', 'story:reply']) ? fromModules.leaves() : null;
            firstRead();
            const jobs = [['story:chat', { chatId: id }]];
            if (same) jobs.push(['story:rebuilt', { reason: 'reload' }]);
            if (heard(['story:chat', 'story:rebuilt'])) later(jobs);
        } else if (REBUILT.has(reason)) {
            announced = null;
            moduleSnap = heard(['story:changed', 'story:reply']) ? fromModules.leaves() : null;
            if (heard(['story:rebuilt'])) later([['story:rebuilt', { reason }]]);
        }
    }
    events.on('turn', onTurn);
    events.on('head', onHead);
    // A module's paths came or went: no change is told for that. A module whose values moved on their own (a scan that finished after the
    // reply) says so, and the difference to the last announcement is told as a `story:changed` of the last reply.
    publicPaths?.onChange(kind => {
        if (!heard(['story:changed', 'story:reply'])) { moduleSnap = null; return; }
        const now = fromModules.leaves();
        if (kind === 'registry' || moduleSnap === null) { moduleSnap = now; return; }
        const changes = diffLeaves(moduleSnap, now);
        moduleSnap = now;
        if (!changes.length) return;
        let index = 0;
        try { index = announced?.index ?? Number(latestIndex()); } catch { index = 0; }
        if (announced) announced = { index: announced.index, leaves: new Map([...announced.leaves].filter(([path]) => !publicPaths.owns(path)).concat([...now])) };
        later([['story:changed', { index: Number.isInteger(index) ? index : 0, changes }]]);
    });

    const api = {
        version: API_VERSION,
        host: String(version),
        ready: null,
        get: Object.freeze(path => frozenCopy(publicPaths?.owns(path) ? fromModules.get(path) : readers.get(headState(), path))),
        paths: Object.freeze(() => deepFreeze([...readers.paths(headState()), ...fromModules.paths()])),
        on: Object.freeze(function on(event, fn) {
            if (!listeners.has(event)) throw new Error(`Story Block API: there is no "${event}" event (known: ${API_EVENTS.join(', ')}).`);
            if (typeof fn !== 'function') throw new Error('Story Block API: on() needs a function.');
            const set = listeners.get(event);
            set.add(fn);
            if (moduleSnap === null && (event === 'story:changed' || event === 'story:reply')) moduleSnap = fromModules.leaves();
            return () => { set.delete(fn); };
        }),
    };
    api.ready = Object.freeze(Promise.resolve(hostReady).then(() => (headState() ? undefined : firstReadDone)).then(() => frozenApi));
    const frozenApi = Object.freeze(api);
    return frozenApi;
}
