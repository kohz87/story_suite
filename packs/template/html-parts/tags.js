// The tag tables of the HTML reader: void, raw-text and RCDATA elements, and the SVG tags whose case is restored.

export const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
export const RAW = new Set(['script', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript', 'plaintext']);
export const RCDATA = new Set(['textarea', 'title']);
const SVG_TAGS = ['altGlyph', 'clipPath', 'feBlend', 'feColorMatrix', 'feComposite', 'feFlood', 'feGaussianBlur', 'feMerge', 'feMergeNode', 'feOffset', 'foreignObject', 'linearGradient', 'radialGradient', 'textPath', 'animateMotion', 'animateTransform'];
export const SVG_TAG_CASE = new Map(SVG_TAGS.map(name => [name.toLowerCase(), name]));
