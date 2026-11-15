// Story Director v2, part **arc**: allowed clock visibility values and reserved plan keys.

export const SHOWN = new Set(['none', 'sign', 'warning']);
// A key the tracker's key index must never be asked for (a plain object's own names).
export const RESERVED_KEYS = new Set(['proto', '__proto__', 'constructor', 'prototype', 'hasownproperty', 'tostring', 'valueof']);
