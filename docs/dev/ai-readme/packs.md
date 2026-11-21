## How a pack is written

A pack is one JSON file (called pack.json inside a zip) of plain data: nothing in it runs. **Format 4** has two kinds, and
a pack says which with `"format": 4` and `"kind"`:

- a **world pack** holds a world: lore, places, routes, regions, a cast, markets, world events, templates, foes and items,
  and where and when the story starts (`start`: `world`, `date`, `place`);
- a **game pack** holds the rules of play: currency, calendar, weather, names, the player's start, an RPG section, data
  modules and meter presets.

A world may suggest a game (`recommends.game`); the reader picks one world and one game in Settings › Packs, and a world zip
may carry its game beside it as game.json. Older formats (3 and below) are refused with a pointer to the converter
(`scripts/packs/convert-3to4.mjs`); a newer format is refused with "update the suite".

The pack checker (`packs/validate.js#validatePack`) reads the file, refuses anything unsafe (script tags, unsafe URLs or CSS,
oversize values, unknown fields) and fills in defaults. Code still sets the numbers: a pack value passes through the rules
and caps. Problems come back as `{ code, path, message }`, each a plain sentence naming the path.

- Ids inside a pack are slugs (lowercase letters, digits and dashes). A route names its two places by name; `start.place`
  names a place by id; every reference is checked when the pack is installed. The full id of a record is `pack.<pack>/<slug>`.
- `requires.suite` is a version range checked against the suite's own version (`{ "suite": "^0.1" }`); `requires.capabilities`
  names what the pack needs the suite to provide.
- Content reaches modules only through queries (`packs.content`, `packs.start`, `packs.calendar`, `packs.economy` and the
  others listed in `docs/dev/packs.md`), so a module that finds no pack works from its defaults. A reader's own setting always
  wins over a pack's value.
- **Check a pack before you share it.** The authoring kit holds the field reference (`authoring-kit/reference/PACK-FORMAT.md`,
  `authoring-kit/reference/LIMITS.md`) and the checker you run on your own file: `node authoring-kit/check.mjs path/to/pack.json`
  (`authoring-kit/check.mjs#checkPack` and the Studio both call `packs/validate.js#validatePack`, so a pack that passes one passes the other).
  The kit's agent notes are `authoring-kit/AGENTS.md`.
- **Worked example.** `examples/packs/ersveil/pack.json` is a full world (Ersveil, with its conversion notes, `examples/packs/ersveil/CONVERSION-NOTES.md`, and portraits) and
  `examples/packs/ersveil-game/pack.json` is its game pack; `examples/packs/ersveil.zip` holds both. Field by field:
  `docs/v2/PACKS.md`, "Pack format 4".

When you add a field or kind to the format: the validator, the safety check, the limit, the docs and a test that a hostile
value is refused all change together.

### A minimal world pack

Two places, a road, one lore entry and a start; the checker prints OK for it (the test runs it). A place needs a `kind` that is
one of the engine's classes (`capital`, `city`, `town`, `village`, `outpost`, `site`, `none`) or mapped in `placeKinds`, and map units `x` and `y`:

```json pack-example
{
  "id": "tiny-world", "format": 4, "kind": "world", "version": "1.0.0",
  "name": "Tiny World", "author": "You", "description": "Two places and a road.",
  "requires": { "suite": "^0.1" },
  "content": {
    "places": [
      { "id": "the-ford", "name": "The Ford", "kind": "village", "x": 10, "y": 20, "note": "A shallow crossing." },
      { "id": "the-mill", "name": "The Mill", "kind": "outpost", "x": 40, "y": 25, "note": "A water mill." }
    ],
    "routes": [{ "from": "The Ford", "to": "The Mill", "kind": "road", "km": 6 }],
    "lore": [{ "title": "The Miller", "keys": ["miller"], "text": "The miller owes the ford-keeper a favour." }],
    "start": { "place": "the-ford" }
  }
}
```

### A minimal game pack

```json game-example
{
  "id": "tiny-game", "format": 4, "kind": "game", "version": "1.0.0",
  "name": "Tiny Game", "author": "You", "description": "Copper and silver, a two-month year.",
  "requires": { "suite": "^0.1" },
  "content": {
    "currency": { "name": "copper", "plural": "copper", "short": "c", "coins": [{ "name": "copper", "plural": "copper", "value": 1 }, { "name": "silver", "plural": "silver", "value": 10 }] },
    "calendar": { "months": [{ "name": "Frost", "days": 30 }, { "name": "Bloom", "days": 30 }], "era": "TY" },
    "start": { "money": 20 }
  }
}
```

## Pack format and kinds

<!-- generated:pack-kinds -->

## Pack limits

<!-- generated:limits -->

## Zip limits

<!-- generated:zip-limits -->

## The Pack Studio

The Studio (`studio/`, described in `docs/dev/studio.md`) is a page that opens a pack (a zip or a JSON file), checks it with the
same checker as the extension, shows and edits each part (a form for each, and every record as JSON, with undo and redo and an
autosaved draft) and exports it again as a zip or JSON. From a checkout, serve the repository root with a static server and
open `/studio/`; Settings › Packs has an Open Studio link. These are its parts:

<!-- generated:studio -->
