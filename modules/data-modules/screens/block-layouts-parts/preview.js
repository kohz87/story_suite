// Draws the shapes of a block that are not plain rows, for the editor's preview and the tab.
import { entriesRoles, drawEntries } from './entries.js';
import { drawNumberMap, numberRows } from './number-map.js';
import { drawRecordCard } from './record-card.js';

/**
 * The block editor's preview (BLOCKEDIT hands it in as `renderPreview`): draws `values` of `definition` in `layout` (cards, bars or fields) with no editors.
 * → { destroy() }.
 */
export function renderBlockPreview(parent, { definition, values, layout }) {
    const doc = parent.ownerDocument ?? globalThis.document;
    const env = { doc, api: null, handles: [], memory: new Map(), after: () => {} };
    const shown = { ...definition, layout };
    drawShapes(env, parent, { definition: shown, module: definition?.id ?? '', who: null, values: values ?? {}, preview: true });
    return { destroy() { for (const handle of env.handles) handle.destroy?.(); env.handles = []; } };
}

/** The int fields a `bars` block draws together as one map of numbers (a number with display names stays a row of its own: it is edited as a choice). */
export const barFields = definition => (definition?.layout === 'bars' ? Object.entries(definition.state ?? {}).filter(([, schema]) => schema.type === 'int' && !schema.names).map(([field]) => field) : []);

/**
 * The shapes of a block that are not plain rows, for the editor's preview: an entries field with roles is drawn through them in any layout, `bars` adds the maps
 * of numbers and the int fields together as bars, `fields` the scalar fields as one record card. (The tab draws the same shapes, with editors, in screens/blocks.js.)
 */
export function drawShapes(env, parent, { definition, module, who, values, preview = false }) {
    // (a preview has no editors: a row with no payload and a field with edit off draw no pencil)
    const rowsOf = args => numberRows(args).map(row => (preview ? { ...row, payload: null } : row));
    const state = definition?.state ?? {}, layout = definition?.layout ?? 'fields';
    const title = text => { const spaced = String(text).replace(/[-_]+/g, ' '); return spaced.charAt(0).toUpperCase() + spaced.slice(1); };
    for (const [field, schema] of Object.entries(state)) if (schema.type === 'entries' && entriesRoles(definition, field)) drawEntries(env, parent, { definition, module, field, list: values?.[field] });
    if (layout === 'cards') {
        // (entries only)
    } else if (layout === 'bars') {
        for (const [field, schema] of Object.entries(state)) {
            if (schema.type === 'map' && schema.values?.type === 'int') drawNumberMap(env, parent, { title: title(schema.label ?? field), memoryKey: `${module}:${who ?? ''}:${field}`, rows: rowsOf({ definition, module, who, values, field }) });
        }
        const fields = barFields(definition);
        if (fields.length) drawNumberMap(env, parent, { title: '', memoryKey: `${module}:${who ?? ''}:fields`, rows: rowsOf({ definition, module, who, values, fields }) });
    } else {
        const lines = Object.entries(state).filter(([, schema]) => schema.type !== 'entries' && schema.type !== 'map')
            .map(([field, schema]) => ({ field, label: schema.label ?? title(field), schema: preview ? { ...schema, edit: false } : schema, value: values?.[field] ?? schema.default }));
        if (lines.length) drawRecordCard(env, parent, { title: '', lines, module, who });
    }
}
