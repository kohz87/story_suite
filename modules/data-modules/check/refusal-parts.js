// Data-modules checker, refusal parts: a kind's `refusals`, the conditions that each add a sentence to its refusal. Pure.
import { conditionType } from '../expressions.js';
import { DM_DESCRIPTORS as D, DM_LIMITS as L } from '../schema.js';
import { shape, sized } from './shape.js';

/** Checks `refusals`: a list of `{ when, text }`; `when` is a condition, `text` bounded safe text ("{field}" shows that field's value). */
export function refusalParts(list, env, path, add) {
    if (!sized(list, L.effects, path, add, { list: true })) return;
    list.forEach((part, at) => {
        const where = `${path}[${at}]`;
        if (!shape(part, D.refusalPart, where, add)) return;
        conditionType(part.when, env, `${where}.when`, add);
        if (typeof part.text !== 'string' || !part.text.trim() || part.text.length > L.text || /[\u0000-\u001f\u007f]/.test(part.text)) add('DM_SCHEMA', `${where}.text`, `A refusal is bounded safe text of at most ${L.text} characters.`);
        for (const [, name] of String(part.text).matchAll(/\{([^{}]*)\}/g)) if (!Object.hasOwn(env.state ?? {}, name)) add('DM_SCHEMA', `${where}.text`, `{${name}} names no field of this module.`);
    });
}
