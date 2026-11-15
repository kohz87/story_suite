// Story Suite v2: the props the dialog widget takes.

export const dialogProps = {
    open: { type: 'boolean', default: true },
    title: { type: 'string', required: true, default: '' },
    text: { type: 'string', default: '' },                 // paragraphs, split on blank lines
    actions: { type: 'array', default: Object.freeze([]) }, // [{ id, label, kind: primary|plain|danger, icon }]
    closable: { type: 'boolean', default: true },          // a × button, Escape and a click behind close it
    alert: { type: 'boolean', default: false },            // role alertdialog: a message that needs an answer
    onSelect: { type: 'string', default: '' },
    label: { type: 'string', default: 'Dialog' },          // the accessible name when there is no title
};
