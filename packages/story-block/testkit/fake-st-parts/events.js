// SillyTavern's event source for the fake: on/off/once/makeFirst, and emit that awaits each listener in order.

/** SillyTavern's event source: on/off/once/makeFirst; emit awaits each listener in order. */
export function createEventSource() {
    const listeners = new Map();
    const list = event => {
        if (!listeners.has(event)) listeners.set(event, []);
        return listeners.get(event);
    };
    const source = {
        emitted: [],
        on(event, fn) { list(event).push(fn); },
        makeFirst(event, fn) { list(event).unshift(fn); },
        once(event, fn) {
            const wrapped = async (...args) => { source.removeListener(event, wrapped); return fn(...args); };
            list(event).push(wrapped);
        },
        removeListener(event, fn) {
            const fns = list(event);
            const index = fns.indexOf(fn);
            if (index >= 0) fns.splice(index, 1);
        },
        listenerCount: event => list(event).length,
        async emit(event, ...args) {
            source.emitted.push([event, ...args]);
            for (const fn of [...list(event)]) await fn(...args);
        },
    };
    source.off = source.removeListener;
    return source;
}
