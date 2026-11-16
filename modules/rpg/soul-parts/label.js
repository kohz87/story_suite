// The Soul Class field's label: the default, the field's own, and the short form for places that say only "class".

/** What the stock Character template calls the field. */
export const SOUL_LABEL = 'Soul Class';
const LABEL_MAX = 40;

/** The field's label, else "Soul Class" (one line, at most 40 characters). */
export function soulLabelOf(schema) {
    const label = typeof schema?.label === 'string' ? schema.label.replace(/\s+/g, ' ').trim() : '';
    return label ? [...label].slice(0, LABEL_MAX).join('') : SOUL_LABEL;
}

/** Whether the field keeps the template's label (then a short place says "class" or "Class"; a renamed field says its own word). */
export const soulIsDefault = label => label === SOUL_LABEL;

/** The label for a place that says only "class": the short word while the label is the default, else the field's own label. */
export const soulShortOf = (label, short) => (soulIsDefault(label) ? short : label);
