// Pack size limits, record bounds and the content kinds a pack may carry.

export const LIMITS = Object.freeze({
    packBytes: 512 * 1024,          // one pack.json, as UTF-8
    installedBytes: 2 * 1024 * 1024, // every installed pack together
    installed: 32,                   // packs in the installed list
    depth: 16,                       // nesting of objects and arrays
    keys: 200,                       // keys in one object
    array: 1000,                     // entries in one array (records of one kind included)
    string: 4000,                    // characters in one string
    code: 64 * 1024,                 // characters in a screen's `template` or `css` (SPEC §13.3)
    name: 80,                        // a display name
    errors: 20,                      // problems reported for one pack before giving up
});
// Shared authoring bounds for host records, also used by pack editors.
export const RECORD_LIMITS = Object.freeze({ slug: 64, note: 500, word: 40, element: 24 });
// Content kinds a pack may carry. Each is a list of records.
export const CONTENT_KINDS = Object.freeze(['items', 'creatures', 'shops', 'recipes', 'events', 'quests', 'races', 'talents', 'skills', 'presets', 'places', 'routes', 'terms', 'ranks', 'crafts', 'meterPresets', 'markets', 'dataModules', 'rpg', 'cast', 'names']);
// Kinds added after the first pack format: a normalized pack has them only when the file gives
// them, so what older packs list (counts) stays as it was.
export const OPTIONAL_KINDS = Object.freeze(['skills', 'presets', 'places', 'routes', 'terms', 'ranks', 'crafts', 'meterPresets', 'markets', 'dataModules', 'rpg', 'cast', 'names']);
