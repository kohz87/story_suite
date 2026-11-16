// Exports the Map widget definition and identifier.

import { render } from './render.js';

export const MAP_WIDGET = 'story-director.map';

/** Prop problems (wrong types only, as Story Block's widgets report them). */
function validate(props = {}) {
    const problems = [];
    for (const name of ['onSelect', 'label', 'viewKey']) if (props[name] !== undefined && typeof props[name] !== 'string') problems.push(`${name} must be text.`);
    if (props.value !== undefined && (props.value === null || typeof props.value !== 'object')) problems.push('value must be the atlas.view data.');
    return problems;
}

/** The widget definition the module registers (module.js merges every part's `widgets`). */
export const atlasMapWidget = Object.freeze({
    props: Object.freeze({
        places: Object.freeze({ type: 'array', default: Object.freeze([]) }),
        routes: Object.freeze({ type: 'array', default: Object.freeze([]) }),
        layers: Object.freeze({ type: 'array', default: Object.freeze([]) }),
        layer: Object.freeze({ type: 'string', default: '' }),
        current: Object.freeze({ type: 'string', default: '' }),
        kinds: Object.freeze({ type: 'object', default: null }),
        orient: Object.freeze({ type: 'object', default: null }),
        trip: Object.freeze({ type: 'object', default: null }),
        onSelect: Object.freeze({ type: 'string', default: '' }),
        label: Object.freeze({ type: 'string', default: 'Map' }),
        viewKey: Object.freeze({ type: 'string', default: 'map' }),
    }),
    primary: 'places',
    validate,
    render,
});
