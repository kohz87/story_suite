// Validates one field or label schema (int, bool, enum, text, map, List of entries).
import { oneLine } from '../../../../text.js';
import { DM_BLOCK_BARS, DM_DESCRIPTORS as D, DM_LIMITS as L, dmInt, dmObject, dmOwn } from '../../schema.js';
import { STRINGS, fill } from '../../../strings.js';
import { E, array } from './helpers.js';
import { shape, sized, distinct } from './structure.js';
import { names } from './names.js';

export function scalar(schema, path, add, { label = false, map = true } = {}) {
    const schemas = label ? D.labels : D.fields;
    const descriptor = dmOwn(schemas, schema?.type) && schemas[schema.type];
    if (!descriptor || (!map && (schema.type === 'map' || schema.type === 'entries'))) { add(label ? 'DM_LABEL' : 'DM_SCHEMA', path, fill(E.declaredSchema, { schema: label ? E.labelSchema : E.fieldSchema })); return; }
    if (!shape(schema, descriptor, path, add, label ? 'DM_LABEL' : 'DM_SCHEMA')) return;
    if (schema.optional !== undefined && (!label || typeof schema.optional !== 'boolean')) add('DM_SCHEMA', `${path}.optional`, STRINGS.blocks.entryLabel);
    if (!label && schema.edit !== undefined && typeof schema.edit !== 'boolean') add('DM_SCHEMA', `${path}.edit`, E.editBoolean);
    if (!label && schema.label !== undefined) {
        if (typeof schema.label !== 'string' || !oneLine(schema.label) || [...schema.label].length > 60) add('DM_SCHEMA', `${path}.label`, STRINGS.blocks.labelLimit);
        else schema.label = oneLine(schema.label);
    }
    // `prompt: false` hides a field from the story's tail and grammar; `names` gives a number's values display names (a kind's int label may
    // carry its own, for a value its effect works out). Neither belongs on the value type of a map; `prompt` is not for a label.
    // `blocks` marks an int field as one of the Standard formula's bars: its value counts the blocks left, the bar's size comes from the stats.
    if (!label && schema.prompt !== undefined && (typeof schema.prompt !== 'boolean' || !map)) add('DM_SCHEMA', `${path}.prompt`, STRINGS.blocks.hiddenFlag);
    if (schema.names !== undefined && !map) add('DM_SCHEMA', `${path}.names`, STRINGS.blocks.namesKey);
    // `scale: 2` (a Standard bar of the doubled sizes, templates-bars.js) goes only on a character's own bars; a bar with no mark is the earlier sizes.
    if (schema.scale !== undefined && (schema.scale !== 2 || !['health', 'stamina', 'mana'].includes(schema.blocks))) add('DM_SCHEMA', `${path}.scale`, STRINGS.blocks.scaleKey);
    if (schema.blocks !== undefined && (label || !map || schema.type !== 'int' || !DM_BLOCK_BARS.includes(schema.blocks))) add('DM_SCHEMA', `${path}.blocks`, STRINGS.blocks.blocksKey);
    if (schema.type === 'int') {
        if (!dmInt(schema.min) || !dmInt(schema.max) || schema.min > schema.max) add('DM_BOUNDS', path, 'Integer bounds must be ordered safe integers.');
        if (!label && !dmInt(schema.default, schema.min, schema.max)) add('DM_BOUNDS', `${path}.default`, 'The integer default must be inside its inclusive bounds.');
        if (schema.names !== undefined && map) names(schema, path, add);
    }
    if (schema.type === 'bool' && !label && typeof schema.default !== 'boolean') add('DM_SCHEMA', `${path}.default`, 'A bool default must be a boolean.');
    if (schema.type === 'enum') {
        distinct(schema.values, `${path}.values`, add);
        if (!label && !array(schema.values).includes(schema.default)) add('DM_BOUNDS', `${path}.default`, 'The enum default must be one of its literal values.');
    }
    if (schema.type === 'text') {
        if (!dmInt(schema.max, 1, L.text)) add('DM_BOUNDS', `${path}.max`, `Text max must be 1 to ${L.text}.`);
        if (!label && schema.list !== undefined && typeof schema.list !== 'boolean') add('DM_SCHEMA', `${path}.list`, STRINGS.blocks.listOnlyText);
        if (!label && (typeof schema.default !== 'string' || !dmInt(schema.max, 1, L.text) || [...schema.default].length > schema.max
            || (schema.list === true && schema.default && schema.default.split(';').length > 12))) add('DM_BOUNDS', `${path}.default`, 'Text defaults must be literal text within max.');
    }
    if (schema.type === 'map') {
        distinct(schema.keys, `${path}.keys`, add, { max: L.mapKeys, keys: true });
        scalar(schema.values, `${path}.values`, add, { map: false });
    }
    if (schema.type === 'entries') entriesField(schema, path, add);
}

// A List of entries: at most `max` entries, each holding the small set of sub-fields in `of` (text, number or choice). A sub-field's name is one lowercase word,
// because it is also the label a story line writes it under ("| status: done"); `at`, `kind` and `who` belong to the line itself.
function entriesField(schema, path, add) {
    if (schema.max !== undefined && !dmInt(schema.max, 1, L.entriesMax)) add('DM_BOUNDS', `${path}.max`, fill(STRINGS.blocks.entriesMax, { max: L.entriesMax }));
    if (!sized(schema.of, L.entrySubs, `${path}.of`, add, { min: 1 })) return;
    for (const [key, sub] of Object.entries(schema.of)) {
        const at = `${path}.of.${key}`;
        if (!/^[a-z]{1,20}$/.test(key) || ['at', 'kind', 'who'].includes(key)) add('DM_SCHEMA', at, STRINGS.blocks.entrySubName);
        if (!dmObject(sub) || !['text', 'int', 'enum'].includes(sub.type)) { add('DM_SCHEMA', at, STRINGS.blocks.entrySubType); continue; }
        if (sub.edit !== undefined || sub.list !== undefined) add('DM_SCHEMA', at, STRINGS.blocks.entrySubType);
        scalar(sub, at, add, { map: false });
    }
}
