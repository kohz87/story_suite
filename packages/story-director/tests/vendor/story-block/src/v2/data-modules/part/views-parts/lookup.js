// Looking up an active module and what it shows: the reference, its values, the screens its pins bring.
import { refuse, copy } from '../../interpreter.js';
import { activeDefinition, actorsOf, instanceOf } from '../../adapters.js';
import { editableLayout } from '../../editable-layout.js';
import { blockTabScreen } from '../../block-screen.js';
import { subjectsOf } from '../shared.js';

export function resolveModule(state, reference) {
    const ids = Object.keys(state?.domains?.dataModules?.active ?? {});
    if (ids.includes(reference)) return reference;
    // (slugs are lowercase; the narrator's capital letter is the only thing forgiven)
    reference = String(reference ?? '').trim().toLowerCase();
    if (ids.includes(reference)) return reference;
    const matches = ids.filter(id => id.split('/')[1] === reference);
    if (matches.length !== 1) refuse('DM_SCHEMA', 'module', matches.length ? `Ambiguous module ${reference}: ${matches.join(', ')}.` : `No active pin for ${reference}.`);
    return matches[0];
}

export function moduleView(state, { module } = {}) {
    const definition = activeDefinition(state, module);
    if (!definition) return null;
    if (definition.scope === 'chat') return { chat: copy(instanceOf(state, module)?.fields ?? {}) };
    const actors = actorsOf(state);
    return { characters: subjectsOf(state, module).map(id => ({ id, name: actors[id]?.name ?? id, ...copy(instanceOf(state, module, id)?.fields ?? {}) })) };
}

// `noTab`: block roles whose block gets no tab of its own (the RPG's Party tab draws them while its feature is on).
export function pinnedPresentation(state, kind = 'screens', noTab = []) {
    return Object.keys(state?.domains?.dataModules?.active ?? {}).flatMap(id => {
        const definition = activeDefinition(state, id);
        const screens = (definition?.[kind] ?? []).map(entry => {
            const screen = copy(entry);
            if (kind === 'screens' && screen.layout) screen.layout = editableLayout(screen.layout, definition);
            return { ...screen, pack: `dm:${id}` };
        });
        if (kind === 'screens') for (const { id: layoutId, title, icon, ...layout } of definition?.layouts ?? []) {
            if (!screens.some(screen => screen.id === layoutId)) screens.push({ id: layoutId, title, ...(icon ? { icon } : {}), mounts: ['tab'], layout: editableLayout(copy(layout), definition), pack: `dm:${id}` });
        }
        if (kind === 'screens') {
            const block = noTab.includes(definition?.role) ? null : blockTabScreen(definition);
            if (block) screens.push(block);
        }
        return screens;
    });
}
