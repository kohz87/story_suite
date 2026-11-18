// Size limits and the allowed tones, text variants and image sizes of a layout.

export const LIMITS = Object.freeze({
    depth: 16,            // nesting of nodes, the root counting as 1
    nodes: 600,           // nodes written in the layout
    bytes: 256 * 1024,    // the layout as JSON
    children: 100,        // children of one container
    pages: 12,            // pages of one tabs node
    listItems: 200,       // rows a list shows at most
    rendered: 3000,       // nodes one render may build (lists inside lists multiply)
    text: 2000,           // characters in one literal text
    cond: 500,            // characters in one condition
    urlHttps: 2048,
    urlData: 200 * 1024,
});

export const TONES = Object.freeze([
    'neutral', 'accent', 'good', 'warn', 'bad',
    'common', 'uncommon', 'rare', 'epic', 'legendary',
]);
export const TEXT_VARIANTS = Object.freeze(['body', 'title', 'label', 'muted']);
export const IMAGE_SIZES = Object.freeze(['small', 'medium', 'large']);
