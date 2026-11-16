// The narrator's grammar for pinned data modules, generated from the frozen declarations (never an author
// regex, never a second `<Changes>` parser): decision 6's short slug reference when it is unique among the
// chat's active pins, the full `pack.<id>/<slug>` otherwise. Shared by the prompt's static part and Setup.
// Public face: re-exports its parts.
export { referenceOf } from './grammar-parts/reference.js';
export { kindGrammar, kindExample } from './grammar-parts/kind-lines.js';
export { fullModuleGrammar, moduleGrammar } from './grammar-parts/module-text.js';
