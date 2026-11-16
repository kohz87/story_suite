// Story Suite v2: keeping the `type` of a template <input> and <button> through DOMPurify by renaming it to TYPE_MARK.

/**
 * SillyTavern's DOMPurify drops the `type` of a template's <input> and <button> (a radio or checkbox came
 * out as a text box showing its value; a type="button" in a form became a submit). compileTemplate
 * renames the attribute to TYPE_MARK before DOMPurify (data attributes pass it) and the allow-list reads
 * it back as `type`, held to INPUT_TYPES / BUTTON_TYPES like a written one. A pack writing TYPE_MARK
 * itself gets no more than writing `type`.
 */
export const TYPE_MARK = 'data-ss-type';
// Names and bare values stop at `<`, so a tag left open stops at the next one: the scan stays linear.
const TYPED_TAG = /<(input|button)\b((?:\s+[^\s"'<>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)(\s*\/?)>/gi;
const TAG_ATTR = /(\s+)([^\s"'<>\/=]+)((?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)/g;

/** `html` with each <input>'s and <button>'s `type` attribute renamed to TYPE_MARK (nothing else changes). */
export function markControlTypes(html) {
    return String(html ?? '').replace(TYPED_TAG, (whole, tag, attrs, end) => {
        const renamed = attrs.replace(TAG_ATTR, (attr, space, name, value) => (name.toLowerCase() === 'type' ? `${space}${TYPE_MARK}${value}` : attr));
        return `<${tag}${renamed}${end}>`;
    });
}
