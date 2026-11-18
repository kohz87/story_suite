// The theme tokens a layout may set and the node types with their fields.

// Theme tokens a layout may set; each becomes `--ss-l-<name>` on the layout's root.
export const TOKENS = Object.freeze([
    'accent', 'bg', 'surface', 'fg', 'muted', 'border', 'radius', 'gap', 'pad', 'font',
    'good', 'warn', 'bad', 'meter', 'meter-bg',
]);

// Field kinds:
//   value    literal (string, number, boolean, null), an `$item` reference, or a binding
//   children array of nodes      node   one node      cond  condition string
//   command  command name        payload plain JSON (strings may be `$item` references)
//   icon     Font Awesome class  cols  integer 1-12   limit integer 1-200
//   pages    [{ title, node }]   props plain JSON object (widgets)
// `bind` is shorthand for the node's main field (`main`).
export const NODE_TYPES = Object.freeze({
    box: { fields: { title: 'value', children: 'children' } },
    row: { fields: { children: 'children' } },
    col: { fields: { children: 'children' } },
    grid: { fields: { cols: 'cols', children: 'children' }, required: ['cols'] },
    text: { fields: { value: 'value', label: 'value', variant: 'variant' }, main: 'value' },
    meter: { fields: { value: 'value', max: 'value', label: 'value', tone: 'value' }, main: 'value' },
    list: { fields: { item: 'node', empty: 'value', limit: 'limit' }, main: 'items', required: ['bind', 'item'] },
    image: { fields: { src: 'value', alt: 'value', size: 'size' }, main: 'src' },
    badge: { fields: { value: 'value', label: 'value', tone: 'value' }, main: 'value' },
    button: { fields: { label: 'value', command: 'command', payload: 'payload', icon: 'icon', tone: 'value' }, required: ['label', 'command'] },
    tabs: { fields: { pages: 'pages' }, required: ['pages'] },
    when: { fields: { cond: 'cond', children: 'children' }, required: ['cond'] },
});
