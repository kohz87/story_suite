// Story Suite v2: the allow-listed HTML and SVG element names, and the ones dropped with their content.

export const HTML_TAGS = new Set([
    'a', 'abbr', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote', 'br', 'button', 'caption', 'cite', 'code',
    'col', 'colgroup', 'data', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em', 'fieldset', 'figcaption',
    'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img', 'input', 'ins',
    'kbd', 'label', 'legend', 'li', 'main', 'mark', 'meter', 'nav', 'ol', 'optgroup', 'option', 'output', 'p',
    'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'section', 'select', 'small', 'span', 'strong',
    'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'time', 'tr', 'u',
    'ul', 'var', 'wbr', 'ss-widget',
]);
export const SVG_TAGS = new Set([
    'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'rect', 'text', 'tspan', 'textPath',
    'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern', 'symbol', 'use', 'title',
    'desc', 'image', 'marker',
]);
/** Dropped together with everything inside them. */
export const DROP_WITH_CONTENT = new Set([
    'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'link', 'meta', 'base',
    'template', 'noscript', 'noembed', 'noframes', 'xmp', 'plaintext', 'title', 'head', 'math', 'foreignObject',
    'animate', 'animateMotion', 'animateTransform', 'set', 'handler', 'listener', 'portal', 'param', 'audio',
    'video', 'source', 'track', 'canvas', 'dialog', 'slot',
]);
