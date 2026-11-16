// The template allow-list (SPEC §13.2). Every template goes through it, after the host's DOMPurify when
// there is one, so the rules hold the same with or without DOMPurify:
// * elements: layout, text, lists, tables, forms (without `action`), images and inline SVG, plus
//   `ss-widget`. `script`, `style`, `iframe`, `object`, `embed`, `link`, `meta`, `base`, `template`,
//   `noscript`, `foreignObject`, SVG animation elements and MathML are dropped with their content; other
//   unknown elements are dropped and their children kept;
// * attributes: an allow-list per element plus `data-*` (not `data-ss-*`) and `aria-*`; never `on*`,
//   `action`, `formaction`, `srcdoc`, `srcset`, `ping`;
// * URLs: `src` (images) `https:` or `data:image/…`; links `https:` or `#…`; SVG `href` `#…` (and on an
//   SVG `<image>`, images as above); anything else drops the attribute;
// * SVG paint and reference attributes (`fill`, `stroke`, `clip-path`, `mask`, `marker-start|mid|end`,
//   `filter`) hold a colour or keyword, or `url(#fragment)` only: an outside SVG resource is never loaded;
// * `style` attributes are filtered like screen CSS (css.js), and `{{ }}` is never read inside them;
// * classes SillyTavern's own delegated handlers or DOM queries act on (RESERVED_CLASSES) are dropped, so a
//   button in a template cannot edit, swipe or delete a message; a control `name` SillyTavern's settings
//   read (RESERVED_NAMES) is dropped. Ids are prefixed per screen when drawn (render.js, css.js);
// * inputs keep safe types (`password`, `file`, `image` become text or go); links that open a new tab get
//   `rel="noopener noreferrer"`.
// `strictSanitize(html)` is the DOMPurify-shaped fallback (string in, string out).
// Public face: re-exports its parts.
export { RESERVED_CLASSES, RESERVED_NAMES, cleanClasses, classAllowed } from './sanitize-parts/reserved.js';
export { paintAllowed } from './sanitize-parts/paint.js';
export { TYPE_MARK, markControlTypes } from './sanitize-parts/control-types.js';
export { PURIFY_CONFIG } from './sanitize-parts/purify-config.js';
export { isImageUrl, isLinkUrl, urlAllowed, isUrlAttr } from './sanitize-parts/urls.js';
export { attrAllowed } from './sanitize-parts/attrs.js';
export { filterNodes } from './sanitize-parts/filter.js';
export { sanitizeNodes, strictSanitize } from './sanitize-parts/run.js';
