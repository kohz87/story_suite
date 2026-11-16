// Story Suite v2: the static text (header, kind grammar, module statics) built from the registry alone.

import { STATIC_MARKER, HAPPENED } from './markers.js';
import { attempt } from './shared-helpers.js';

const HEADER = [
    STATIC_MARKER,
    `Code keeps this story's facts and numbers; you narrate. A note starting ${HAPPENED} has just happened: tell it in the scene, keep its numbers, do not write it again as a change.`,
].join('\n');

const CHANGES_HEADER = [
    'At the very end of your reply, after the story, list what changed in one block (outside any thinking, once; it counts toward no length limit):',
    '<Changes>',
    'op kind Name — what happened | label: value',
    '</Changes>',
    'op: + new or gained, - gone or lost, ~ changed, ! happened, ? asks code to decide (a check, a roll). One change per line, only the kinds below; leave out what did not change, and the whole block when nothing did.',
    'This is the only block you write: no state, inventory or party blocks.',
    'Kinds:',
].join('\n');

/**
 * The static text alone (header + kind grammar + module statics), built from the registry only.
 * `problems` collects what failed (a throwing static() is left out, logged there). `hint` (optional): { view, rolled }, what the reply being
 * prepared tells the parts that write less on a quiet reply (the RPG's combat text, data-modules/part.js); without it every part is in full.
 */
export function staticParts(registry, problems = [], hint = undefined) {
    const contexts = registry.contexts(hint);
    const kinds = contexts.flatMap(context => context.kinds.map(kind => kind.grammar)).filter(Boolean);
    const header = kinds.length ? `${HEADER}\n${CHANGES_HEADER}\n${kinds.join('\n')}` : HEADER;
    const parts = [{ module: 'story-suite', label: 'Story Suite: instructions', place: 'static', text: header }];
    for (const context of contexts) {
        if (typeof context.static !== 'function') continue;
        const text = attempt(() => context.static(hint), '', problems, `${context.name}: instructions`);
        const clean = typeof text === 'string' ? text.trim() : '';
        if (clean) parts.push({ module: context.moduleId, label: `${context.name}: instructions`, place: 'static', text: clean });
    }
    return parts;
}

/**
 * The static text as it would be with other feature switches (`switches`: a Map or object, feature id → true | false; the
 * rest as they are), built by the registry's own `withFeatures` so nothing is switched, stored or told: what the Features
 * page counts for each preset. The same text `assemble` sends (names not filled in). null when the registry cannot say
 * (no `withFeatures`) or a part fails: the caller leaves the number out.
 */
export function staticTextWith(registry, switches) {
    if (typeof registry?.withFeatures !== 'function') return null;
    try {
        return registry.withFeatures(switches, () => staticParts(registry).map(part => part.text).join('\n\n'));
    } catch {
        return null;
    }
}
