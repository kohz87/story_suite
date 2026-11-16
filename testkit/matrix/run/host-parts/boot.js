// Boots a matrix host with seeded ids and captured console output, and runs a function on it.

import { createHost } from '../../../host.js';
import { ORDER } from '../../modules.js';

const oneLine = text => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 360);

function seededCrypto(seed) {
    let x = seed | 0;
    const next = () => {
        x = (x + 0x9E3779B9) | 0;
        let z = x;
        z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B);
        z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35);
        return (z ^ (z >>> 16)) >>> 0;
    };
    return {
        getRandomValues(array) {
            for (let i = 0; i < array.length; i += 1) array[i] = array instanceof Uint8Array ? next() & 0xFF : next();
            return array;
        },
        randomUUID: () => `00000000-0000-4000-8000-${String(next()).padStart(12, '0').slice(0, 12)}`,
    };
}

/**
 * A host with Story Block's core and the given module keys (registered in ORDER, `withhold` left
 * out for a late registration, `extra` definitions after them). Receipt ids and seeds come from a seeded
 * counter while it lives, console warnings are kept in `host.noise`, and `globalThis.StoryBlock` is the
 * host's, as in SillyTavern; `await host.release()` puts all of that back.
 */
async function boot(env, keys, { withhold = [], extra = [] } = {}) {
    const ref = { sdk: null };
    const definitions = ORDER.filter(key => keys.includes(key) && !withhold.includes(key)).map(key => env.loaded[key].make(ref));
    const savedCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const savedConsole = { warn: console.warn, error: console.error, log: console.log, info: console.info };
    const savedBlock = Object.getOwnPropertyDescriptor(globalThis, 'StoryBlock');
    const noise = [];
    const restore = () => {
        console.warn = savedConsole.warn;
        console.error = savedConsole.error;
        console.log = savedConsole.log;
        console.info = savedConsole.info;
        if (savedBlock) Object.defineProperty(globalThis, 'StoryBlock', savedBlock); else delete globalThis.StoryBlock;
        if (savedCrypto) Object.defineProperty(globalThis, 'crypto', savedCrypto);
    };
    Object.defineProperty(globalThis, 'crypto', { value: seededCrypto(1), configurable: true, writable: true });
    console.warn = (...args) => { noise.push(['warn', oneLine(args.join(' '))]); };
    console.error = (...args) => { noise.push(['error', oneLine(args.join(' '))]); };
    console.log = (...args) => { noise.push(['log', oneLine(args.join(' '))]); };
    console.info = console.log;
    let host;
    try {
        host = await createHost({ modules: [...definitions, ...extra] });
    } catch (error) {
        restore();
        throw error;
    }
    ref.sdk = host.sdk;
    globalThis.StoryBlock = { apiVersion: 2, ready: Promise.resolve(host.sdk), sdk: host.sdk };
    const close = host.close;
    // `release` puts the globals back after the host's last timers have run (the assist helpers log late).
    host.release = async () => {
        close();
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));
        restore();
    };
    host.noise = noise;
    host.ref = ref;
    return host;
}

async function withHost(env, keys, options, fn) {
    const host = await boot(env, keys, options);
    try { return await fn(host); } finally { await host.release(); }
}
export { oneLine, boot, withHost };
