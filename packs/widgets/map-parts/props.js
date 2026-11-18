// The map widget's props: its nodes, edges, layers, fog and switches.

export const props = {
    nodes: { type: 'array', required: true, default: Object.freeze([]) },   // [{ id, name, x, y, icon, layer, kind }]
    edges: { type: 'array', default: Object.freeze([]) },                   // [{ from, to, kind }]
    layers: { type: 'array', default: null },                               // ['surface'] or [{ id, name }]
    layer: { type: 'string', default: '' },                                 // the layer to show first
    current: { type: 'string', default: '' },                               // the reader's place
    discovered: { type: 'array', default: null },                           // ids; null: everything is known
    fog: { type: 'string', default: 'hide' },                               // 'hide' | 'unknown'
    kinds: { type: 'object', default: null },                               // { kind: { label, icon } }
    onSelect: { type: 'string', default: '' },                              // command run with { node }
    label: { type: 'string', default: 'Map' },
    minimap: { type: 'boolean', default: true },
    legend: { type: 'boolean', default: true },
};
