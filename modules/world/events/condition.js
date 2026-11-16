// The condition language of pack events (SPEC §9, MODULES §E).
//
// A pack is data from somewhere else, so its conditions are never run as JavaScript: no `eval`, no
// `Function`, no property walk the source did not spell out. A condition is read by a small tokenizer
// and a recursive-descent parser into a plain AST, then walked by an evaluator that knows only these:
//
//   literals     12  3.5  'text'  "text"  true  false  null  { key: value }  (records only as call args)
//   operators    !  -(number)  <  <=  >  >=  ==  !=  &&  ||  ( … )   (a record or list == only null)
//   reads        .name  [index]   on what a call returned
//   calls        query(name, args?)  quest(key)  has(itemName, qty?)  time()  actor(name)  count(list)  region(name, …)
//
// Precedence, loosest first: `||`, `&&`, `== !=`, `< <= > >=`, `! -`, then `.x [n] (…)`. Comparisons
// do not chain (`1 < x < 3` is refused, write `1 < x && x < 3`). There is no truthiness: `&&`, `||`
// and `!` take true or false, `==` never converts (`1 == '1'` is false), `<` compares two numbers or two
// words. The whole condition must come out true or false.
//
// Other users of the language (SPEC §13.2 template expressions) may pass parse options for extra calls
// and bare names read from a scope; events never do, so a pack event sees exactly the list above.
//
// Errors are values. Nothing here throws at the caller: `parse` and `evaluate` return
// `{ ok: false, error: { code, message, at } }`, and `evaluateCondition` reports a condition that
// errors as not met, with the reason, so the Events debug section can say why an event waits.
// The errors, tokenizer and parser live in the adjacent condition-* files; this file keeps the evaluator and entry points.
// Public face: re-exports its parts.

export { CALLS } from './calls.js';
export { LIMITS } from './condition-errors.js';
export { tokenize } from './condition-tokenizer.js';
export { parse } from './condition-parser.js';
export { kindOf, evaluate } from './condition-parts/walk.js';
export { compile, evaluateCondition } from './condition-parts/entry.js';
