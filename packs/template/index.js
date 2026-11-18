// Screen templates (SPEC §13.2): compile an HTML template once, then render it into an element from a
// scope as often as the state changes. Public interface:
//
//   compileTemplate(html, { sanitize? }) → { nodes, warnings }        // frozen; reuse it for every render
//   renderTemplate(el, compiled, scope, { command, widgets, evaluate, onDraft, onSubmit, onResult, onWarn, api, formatters })
//     → view { el, warnings, draft(), update(scope), destroy() }
//   destroyTemplate(el), strictSanitize(html), PURIFY_CONFIG
//
// `sanitize` is SillyTavern's DOMPurify (`DOMPurify.sanitize`, called as `sanitize(html, PURIFY_CONFIG)`);
// the strict allow-list (sanitize.js) runs after it either way, and is all there is without DOMPurify.
// Nothing from data ever reaches innerHTML: the page is built with createElement / setAttribute /
// textContent from the compiled tree, and every bound URL is checked again before it is set.
//
// Bindings (the template reference with examples is docs/v2/TEMPLATES.md):
//   {{ expr }}                     text, in text nodes and allowed attributes (not `style`)
//   data-bind="expr"               the element's text
//   data-bind-attr="a: expr; …"    attributes (URL attributes re-checked; false/null removes)
//   data-bind-var="--x: expr; …"   CSS custom properties
//   data-each="list as item[, i]"  repeat the element (records: values in key order, `i` is the key)
//   data-if="expr"                 keep the element only while truthy (applied per item inside data-each)
//   data-class="name: expr; …"     toggle classes
//   data-command="type" [data-payload='{"stack":"{{ s.id }}"}']   a click runs a command
//   data-draft="path"              an input fills the draft (text, number, range, select, radio, checkbox, textarea); a <button value="x"> picks x (again: clears)
//   data-draft-close="path"        Escape inside, or a press on an inner [data-draft-cancel], clears that draft value
//   data-submit="type"             a form's submit (or an element's click) sends the draft as one command
//   <ss-widget name="ss.meter" data-props='{"bind":"q.pc.hp"}'></ss-widget>   a registered widget
//
// Public face: re-exports its parts.

export { PURIFY_CONFIG, strictSanitize } from './sanitize.js';
export { renderTemplate, destroyTemplate } from './render.js';
export { isCompiled, compileTemplate } from './index-parts/compile.js';
export { MAX_LOOP_DEPTH, templateShape } from './index-parts/shape.js';
