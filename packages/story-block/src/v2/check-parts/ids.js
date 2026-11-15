// ID checks: the record and definition ID patterns, isId and the id check.
/** `<prefix>_<8 base36>` as `sdk.id(prefix)` makes them: `it_k3f9a2qz`. */
export const RECORD_ID = /^[a-z][a-z0-9]*_[0-9a-z]{8}$/;
/** Definition IDs are namespaced slugs: `story/moonveil-trout`, `pack.fantasy/iron-sword`. */
export const DEF_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

/** True for a record ID (of `prefix`, when given) or, without a prefix, a definition ID too. */
export function isId(value, prefix) {
    if (typeof value !== 'string') return false;
    if (prefix) return RECORD_ID.test(value) && value.startsWith(`${prefix}_`);
    return RECORD_ID.test(value) || DEF_ID.test(value);
}

/** id(v, 'it') wants `it_xxxxxxxx`; id(v) takes any record ID or a definition ID. */
export function id(value, prefix) {
    if (isId(value, prefix)) return '';
    return prefix
        ? `must be an ID like ${prefix}_k3f9a2qz`
        : 'must be an ID like it_k3f9a2qz or story/moonveil-trout';
}
