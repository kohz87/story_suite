// Example values for the preview of a built definition.
/**
 * Example values for the preview of a built definition (a new block has no data): two entries for a List of entries (the first two status values, so the
 * Finished fold has something), the middle of a number's range, the field's name for a text.
 */
export function exampleValues(definition) {
    const out = {};
    for (const [key, schema] of Object.entries(definition?.state ?? {})) {
        if (schema.type === 'entries') {
            const status = schema.of[definition.roles?.status];
            out[key] = [0, 1].map(at => Object.fromEntries(Object.entries(schema.of).map(([part, sub]) => [part,
                sub.type === 'int' ? Math.round((sub.min + sub.max) / 2) : sub.type === 'enum' ? (sub === status ? sub.values[Math.min(at, sub.values.length - 1)] : sub.values[0])
                    : `${sub.label ?? part} ${at + 1}`])));
        } else out[key] = schema.type === 'int' ? Math.round((schema.min + schema.max) / 2) : schema.type === 'enum' ? schema.default : schema.type === 'bool' ? schema.default : schema.label ?? key;
    }
    return out;
}
