// Every text Story Block's v2 screens and page furniture show the reader, in one place (MODULES §F56):
// English for now, kept together so a translation later is one file. Code refers to a text by its key
// (`STRINGS.bar.story`); a text with holes names them in braces (`'{n} more'`) and is filled with `fill`.
//
// * `fill(text, values)`: plain text (textContent, summaries). A hole without a value stays as written.
// * `html(text, values)`: for screen templates. The text is HTML-escaped first, then the holes are filled
//   with the values as they are, so a hole can take a template binding (`{{ it.qty }}`).
// * `jsonText(text)`: a text inside a JSON string in a template attribute (`data-props='{"label":"…"}'`).
//
// Existing messages written by the runtime and other parts stay with their owners; inline-edit messages are below.
// Public face: re-exports its parts.
export { STRINGS } from './strings-parts/table.js';
export { fill, escapeHtml, html, jsonText } from './strings-parts/text.js';
export { refusalText } from './strings-parts/refusal.js';
