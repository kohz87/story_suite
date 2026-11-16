// The display names of an int field.
import { oneLine } from '../../../../core/text.js';
import { DM_LIMITS as L, dmInt, dmObject } from '../../schema.js';
import { STRINGS } from '../../../../core/strings.js';

const foldedName = text => String(text).normalize('NFKC').toLowerCase();
// Display names for an int field: { "<value>": "<name>" }, whole values inside min..max, short distinct names that are not numbers.
export function names(schema, path, add) {
    const given = schema.names;
    if (!dmObject(given) || !Object.keys(given).length || Object.keys(given).length > L.names) { add('DM_BOUNDS', `${path}.names`, STRINGS.blocks.namesLimit); return; }
    const seen = new Set();
    for (const [key, name] of Object.entries(given)) {
        const at = `${path}.names.${key}`;
        if (!/^-?\d+$/.test(key) || String(Number(key)) !== key || !dmInt(Number(key), schema.min, schema.max)) add('DM_BOUNDS', at, STRINGS.blocks.namesKey);
        const text = typeof name === 'string' ? oneLine(name) : '';
        if (!text || [...text].length > L.nameText || /^-?\d+$/.test(text)) { add('DM_SCHEMA', at, STRINGS.blocks.namesText); continue; }
        given[key] = text;
        if (seen.has(foldedName(text))) add('DM_SCHEMA', at, STRINGS.blocks.namesSame);
        seen.add(foldedName(text));
    }
}
