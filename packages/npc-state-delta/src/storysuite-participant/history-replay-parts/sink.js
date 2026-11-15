// The recording sink that stands in for every outward write while history replay runs.

export function makeSink() {
    const calls = [];
    const methods = new Map();
    const record = (name, args) => {
        calls.push({ name, args });
        return undefined;
    };
    const target = (...args) => record('write', args);
    const sink = new Proxy(target, {
        apply: (_target, _thisArg, args) => record('write', args),
        get(object, property) {
            if (property === 'calls' || property === 'writes' || property === 'records') return calls;
            if (Reflect.has(object, property)) return Reflect.get(object, property);
            if (typeof property !== 'string') return undefined;
            if (!methods.has(property)) methods.set(property, (...args) => record(property, args));
            return methods.get(property);
        },
    });
    sink.calls = calls;
    return sink;
}
