// The form engine's page-wide control ids.

let serial = 0;
/** A fresh id for a control or a message ("ss-f3-budget"): ids are unique per page, not per form. */
export const newId = hint => `ss-f${(serial += 1)}-${String(hint ?? 'x').replace(/[^\w-]/g, '_')}`;
