// The names and props of the story-block.fields and story-block.heading layout nodes, and their stub widgets.
export const FIELDS_WIDGET = 'story-block.fields';
export const HEADING_WIDGET = 'story-block.heading';
export const FIELDS_PROPS = Object.freeze(['module', 'field', 'fields', 'as', 'title', 'names', 'labels', 'units', 'tones', 'tiles']);
export const BLOCK_NODE_WIDGETS = Object.freeze({
    [FIELDS_WIDGET]: Object.freeze({ props: {}, primary: null, validate: () => [], render: () => ({ destroy() {} }) }),
    [HEADING_WIDGET]: Object.freeze({ props: {}, primary: null, validate: () => [], render: () => ({ destroy() {} }) }),
});
