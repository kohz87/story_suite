// Story Suite v2: reads and writes a DOM member as the element's own interface has it, never a <form>'s control of that name.

// A DOM member as the element's own interface has it, never a <form>'s control of that name or id: the
// prototype chain first (the browser's members live there), then the element's own property (the test
// DOM keeps some on the instance).
function descriptorOf(el, name) {
    for (let proto = Object.getPrototypeOf(el); proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
        const found = Object.getOwnPropertyDescriptor(proto, name);
        if (found) return found;
    }
    return Object.getOwnPropertyDescriptor(el, name) ?? null;
}
export function dom(el, name) {
    const found = descriptorOf(el, name);
    if (!found) return undefined;
    return found.get ? found.get.call(el) : found.value;
}
export function setDom(el, name, value) {
    const found = descriptorOf(el, name);
    if (found?.set) found.set.call(el, value);
    else el[name] = value;
}
export const call = (el, name, ...args) => dom(el, name).apply(el, args);
