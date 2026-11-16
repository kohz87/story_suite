// Reading Story Director data modules from state: the actors, the active definition, an instance and its public view.
import { copy } from '../interpreter.js';

export const actorsOf = state => Object.fromEntries(Object.entries(state?.domains?.checks?.policy?.actors ?? {})
    .filter(([id, actor]) => /^ca_[a-z0-9]{8}$/.test(id) && actor.id === id && typeof actor.name === 'string')
    .sort(([a], [b]) => a.localeCompare(b)).map(([id, actor]) => [id, { id, name: actor.name }]));

export function activeDefinition(state, module) {
    const domain = state?.domains?.dataModules, active = domain?.active?.[module];
    const pin = active && domain.pins?.[active.hash];
    return pin?.interpreter === 1 && pin.definition?.schema === 1 ? pin.definition : null;
}
export const instanceOf = (state, module, who = 'chat') => who === 'chat'
    ? state?.domains?.dataModules?.instances?.[module]?.chat
    : state?.domains?.dataModules?.instances?.[module]?.characters?.[who];

export function publicView(state, { module, export: name, who } = {}) {
    const definition = activeDefinition(state, module), fields = definition?.exports?.[name]?.fields;
    const active = state?.domains?.dataModules?.active?.[module];
    if (!fields || (definition.scope === 'character' && !active.subjects.includes(who))) return null;
    const instance = instanceOf(state, module, definition.scope === 'chat' ? 'chat' : who);
    if (!instance) return null;
    return Object.fromEntries(fields.map(key => [key, copy(instance.fields[key])]));
}
