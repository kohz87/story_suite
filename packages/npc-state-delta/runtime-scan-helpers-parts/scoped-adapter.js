// The adapter as a history replay sees it: reads answer from the state after one reply, host writes are not sent.

// Story Block as a replay sees it: reads answer from the state after reply `index` (sdk.query { asOf }, adapter.at), writes are not sent.
const HOSTED_WRITES = new Set(['adjust', 'setMeters', 'refresh', 'applyEditor', 'openByEvent', 'tick']);
export function scopedAdapter(adapter, index, sink) {
    // The adapter is frozen, and a Proxy `get` may not answer a different value for a frozen target's read-only property: proxy a plain copy.
    return new Proxy({ ...adapter }, {
        get(target, name) {
            const value = target[name];
            if (typeof value !== 'function') return value;
            if (HOSTED_WRITES.has(name)) return (...args) => { sink.hostedWrite(name, args); return Promise.resolve(null); };
            return (...args) => (typeof target.at === 'function' ? target.at(index, () => value(...args)) : value(...args));
        },
    });
}
