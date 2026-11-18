## How a pack is written

A pack is one JSON file (called pack.json inside a zip) of plain data: nothing in it runs. Format 4 has two kinds: a world pack
(places, routes, lore, a cast, events, factions, where and when the story starts) and a game pack (currency, calendar, weather, names,
rules, the player's start). A world zip may carry its game pack beside it, as game.json. The pack checker
(`packs/validate.js`) reads it, refuses anything unsafe (script tags, unsafe URLs or CSS, oversize values) and fills in
defaults. Code still sets the numbers: a pack value passes through the rules and caps.

- Ids are `pack.<pack>/<slug>`; references inside a pack are checked when it is installed.
- `format` says which pack format the file is written for. A newer format than the suite reads is refused with a plain
  message. This section describes the format the suite reads now (the table below).
- Content reaches modules only through queries (`packs.content`, `packs.start`, `packs.calendar` and the others listed in
  `docs/dev/packs.md`), so a module that finds no pack works from its defaults.
- Check a pack before you share it: the authoring kit (`authoring-kit/reference/PACK-FORMAT.md` and
  `authoring-kit/reference/LIMITS.md`) holds the field reference, and `authoring-kit/check.mjs` is the checker you run on your own file. The Pack
  Studio (below) runs the same checker in the browser.
- A worked example is `examples/packs/ersveil/pack.json` (a world; its game pack is in the ersveil-game folder beside it). Field by field: `docs/v2/PACKS.md` "Pack format 4".

When you add a field or kind to the format: the validator, the safety check, the limit, the docs and a test that a hostile
value is refused all change together.

## Pack format and kinds

<!-- generated:pack-kinds -->

## Pack limits

<!-- generated:limits -->

## Zip limits

<!-- generated:zip-limits -->

## The Pack Studio

The Studio (`studio/`, described in `docs/dev/studio.md`) is a page that opens a pack (a zip or a JSON file), checks it with the same checker as the
extension, shows each part read only and exports it again as a zip or JSON; editing is not built yet. These are its parts:

<!-- generated:studio -->
