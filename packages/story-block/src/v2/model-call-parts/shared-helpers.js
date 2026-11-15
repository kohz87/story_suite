// Small helpers the model-call files share: SillyTavern's context, text filling and the clock.

export const context = () => globalThis.SillyTavern?.getContext?.() ?? null;

export const fill = (text, values) => text.replace(/\{(\w+)\}/g, (all, key) => (Object.hasOwn(values, key) ? String(values[key]) : all));

export const now = () => (typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now());
