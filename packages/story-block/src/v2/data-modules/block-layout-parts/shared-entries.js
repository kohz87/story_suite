// Shared by the block-layout parts: the entries fields of a draft.
export const entriesOf = draft => (Array.isArray(draft?.fields) ? draft.fields.filter(field => field?.type === 'entries') : []);
