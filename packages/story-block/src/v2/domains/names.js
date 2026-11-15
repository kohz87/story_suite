// Item names: the alias index, singular/plural tolerance and story slugs. Pure.
//
// The model writes names, code keeps IDs (§2.1). A name is looked up in the inventory's
// `aliases` (lowercase name → def ID). The alias index is authoritative: an exact alias wins.
// Without one, the name's singular and plural forms are tried against the aliases and the
// defs' own names; when that finds more than one def the name is ambiguous and the caller
// rejects it rather than pick one (§4.4).
// Public face: re-exports its parts.

export { cleanName, aliasKey, trimText } from './names-parts/clean.js';
export { nameForms } from './names-parts/forms.js';
export { portionless, looseKey } from './names-parts/loose.js';
export { resolveDef } from './names-parts/resolve.js';
export { slugify } from './names-parts/slug.js';
