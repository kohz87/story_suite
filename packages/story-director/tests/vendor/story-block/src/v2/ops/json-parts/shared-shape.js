// Plain-object test and the one safe way to set a key ("__proto__" as an own key), shared by the JSON helpers. Pure.

export function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

export function setKey(target, key, value) {
    if (key === '__proto__') Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
    else target[key] = value;
}
