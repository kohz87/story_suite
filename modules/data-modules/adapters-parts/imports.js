// Projecting a definition's public imports from state into the inputs a data module reads.
import { copy, atPath, refuse } from '../interpreter.js';
import { actorsOf, publicView } from './state-views.js';

export function projectImport(state, entry) {
    let value;
    if (entry.query === 'director.time') value = { minutes: state?.domains?.director?.time?.minutes ?? null };
    else if (entry.query === 'checks.policy') value = { actors: actorsOf(state) };
    else if (entry.query === 'dataModules.public') value = publicView(state, entry.args);
    else refuse('DM_SCHEMA', entry.query, 'Unsupported public adapter.');
    if (value === null) return null;
    // Actor selectors denote projection over the public actor map, not numeric array paths.
    if (entry.query === 'checks.policy') return { actors: Object.fromEntries(Object.entries(value.actors)
        .map(([id, actor]) => [id, Object.fromEntries(entry.projection.map(key => key.split('.')[1]).map(key => [key, actor[key]]))])) };
    return Object.fromEntries(entry.projection.map(path => [path, copy(atPath(value, path.split('.')))]));
}

export function inputsOf(state, definition) {
    return Object.fromEntries(Object.entries(definition.imports).map(([alias, entry]) => [alias, projectImport(state, entry)]));
}
