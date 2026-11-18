// Bindings (SPEC §13.2): what a screen's template (and the JSON layout renderer, which shares this file)
// reads from. A binding is resolved against a **scope**:
//
//   { state, q, draft, settings, query?, <loop names>…, ratio, pct, changed, len, contains, sum, fmt: { money, time } }
//
// Every name is a top-level identifier, so the scope is what `evaluate(expr, scope)` gets as it is (the
// layout renderer's `{ item, index, query }` scope has the same shape).
//
// * `state.<domain>.…` is the State at the mount's carrier (read-only). The scope holds a flat view of the
//   document (`{ v, meta, ...domains }`), so `state.party.actors` reads `domains.party.actors` and
//   `state.meta.rev` reads `meta.rev`.
// * `q.<alias>` the screen's `data` queries, `draft.…` the dialog's draft, `settings.…` the module's
//   settings, and the names `data-each` gives its items.
//
// Two kinds of binding text:
// * A **path** (`pc.hp.cur`, `state.inventory.defs[s.def].name`, `list[0]`, `defs['story/trout']`) is read
//   here, own properties only (never `__proto__`, `constructor`, `prototype`).
// * Anything else is an **expression** in the events condition language (src/v2/events), evaluated by an
//   injected `evaluate(expr, scope)`. A path, a literal, `!x` and a helper call whose arguments are those
//   (`ratio(hp.cur, hp.max)`, `fmt.money(q.purse)`) are read here directly, so the common bindings work
//   and stay cheap without the condition engine.
//
// `changed(path)` is true when this carrier's ops touched the path: an op at it, under it, or above it
// (a whole record replaced). Its argument is a path, written bare (`changed(s.qty)`) or quoted
// (`changed('state.scene.place')`), or a JSON Pointer (`changed('/domains/scene/place')`). A bare path is
// passed to `evaluate` quoted, so the condition language only ever sees a string there.
// Pure: no DOM, no clock, no randomness.
// Public face: re-exports its parts.

export { changedPointers, touches } from './bind-parts/changes.js';
export { conditionEvaluator, compileExpr, evalExpr, TEMPLATE_CALLS } from './bind-parts/expressions.js';
export { defaultFormatters } from './bind-parts/formatters.js';
export { contains, len, sum } from './bind-parts/list-helpers.js';
export { pct, ratio } from './bind-parts/ratio-pct.js';
export { pathKeys, pointerOf, resolvePath, valueAtKeys } from './bind-parts/path-read.js';
export { parsePath } from './bind-parts/path-syntax.js';
export { RESERVED } from './bind-parts/path-names.js';
export { setIn } from './bind-parts/path-write.js';
export { isScope, makeScope, stateView } from './bind-parts/scope-build.js';
export { withDraft, withItem } from './bind-parts/scope-child.js';
export { interpolate, parseInterpolation, toText } from './bind-parts/interpolation.js';
export { splitPairs } from './bind-parts/pair-lists.js';
export { isLoopName } from './bind-parts/loop-name.js';
