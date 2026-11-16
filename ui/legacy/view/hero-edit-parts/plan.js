// Hero editor: the plan, the commands a Save sends for the fields that changed.

import { STRINGS } from '../../../../core/strings.js';
import { CLOCK_KEYS } from './shared-limits.js';
import { timeMinutes, hereNames, hereText } from './time-here.js';

const S = STRINGS.scene;

/**
 * The editor's `plan(changed, all)` for the hero's props: `changed` holds the fields whose value differs from what the form opened with, `all` every
 * field. → `{ error }` (a sentence, nothing sent) or `{ steps: [{ command, payload, keys }] }`, in the order above.
 */
export function heroEditPlan(p) {
    const where = p?.where && typeof p.where === 'object' ? p.where : {};
    const you = p?.you && typeof p.you === 'object' ? p.you : null;
    const command = typeof you?.command === 'string' && you.command ? you.command : 'scene.you';
    const present = hereNames(hereText(where.present));
    return (changed = {}, all = {}) => {
        const steps = [];
        const has = key => Object.hasOwn(changed, key);
        if (CLOCK_KEYS.some(has)) {
            const minutes = timeMinutes(all.time);
            const { year, month, day } = all;
            if (!Number.isSafeInteger(year) || !Number.isSafeInteger(month) || !Number.isSafeInteger(day) || minutes === null) return { error: S.clockNeeded };
            steps.push({ command: 'director.clock', payload: { year, month, day, minutes }, keys: [...CLOCK_KEYS] });
        }
        // The people stay with a move, as they did when the place had its own pencil.
        if (has('place')) steps.push({ command: 'scene.place', payload: { with: present, name: String(changed.place) }, keys: ['place'] });
        if (has('weather')) steps.push({ command: 'scene.weather', payload: { text: String(changed.weather) }, keys: ['weather'] });
        // The same people typed with other spaces are no change.
        const people = has('here') ? hereNames(changed.here) : present;
        if (has('here') && (people.length !== present.length || people.some((name, at) => name !== present[at]))) steps.push({ command: 'scene.present', payload: { set: people }, keys: ['here'] });
        const look = {};
        for (const part of ['rank', 'wearing', 'condition']) if (has(part)) look[part] = String(changed[part]);
        if (Object.keys(look).length) steps.push({ command, payload: look, keys: Object.keys(look) });
        return { steps };
    };
}
