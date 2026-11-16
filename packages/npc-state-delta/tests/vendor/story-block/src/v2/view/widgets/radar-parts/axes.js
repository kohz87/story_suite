// Cleans the radar's axes: label, value, max and the optional before value.

import { num, str } from '../dom.js';

const MAX_AXES = 24;

/** Clean axes: label, value, max and optional before, at most 24. */
export function radarAxes(axes, before, sharedMax = 0) {
    const list = (Array.isArray(axes) ? axes : []).slice(0, MAX_AXES).map((axis, index) => {
        const item = axis && typeof axis === 'object' ? axis : { value: axis };
        const prior = item.before ?? (Array.isArray(before) ? before[index] : undefined);
        return {
            label: str(item.label) || str(item.name),
            value: Math.max(0, num(item.value, 0)),
            max: num(item.max, 0),
            before: prior === undefined || prior === null || !Number.isFinite(num(prior, NaN)) ? null : Math.max(0, num(prior, 0)),
        };
    });
    const top = Math.max(1, num(sharedMax, 0), ...list.map(axis => Math.max(axis.value, axis.before ?? 0)));
    for (const axis of list) if (!(axis.max > 0)) axis.max = num(sharedMax, 0) > 0 ? num(sharedMax, 0) : top;
    return list;
}
