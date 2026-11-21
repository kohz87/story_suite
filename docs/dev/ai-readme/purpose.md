## What this is

Story Suite is one SillyTavern extension for roleplay and story chats. It keeps the story's state (the scene, the bag, the
people, the clock, the world, a fight) as data next to the chat, shows it in a view of its own, and tells the model the parts
that matter on each reply. The reader's own words and the story stay in charge: state changes come from what the story says
(change lines the model writes at the end of a reply) or from the reader's own clicks.

This file is the reference for a developer, or a developer's coding agent, who writes a **module** (code that plugs into the
host) or a **pack** (a plain-data world or game). Read it first, then the pointers in each section. Every file and export
named in backticks is checked by the generator against the code, and the tables are read from the code, so they cannot go
stale; a sentence that is only prose is checked by the tests named beside it.

Version of the extension, read from `core/version.js` (one number for the whole extension, written everywhere by
`scripts/release.mjs`):

<!-- generated:version -->

- Call the people module **NPC State** in anything a person reads. Its folder is `modules/people`.
- The code map is the way into the code: `docs/codemap.md` lists every file with its one job, its exports and its tests;
  `docs/codemap/` has one map per area. `docs/dev/codemap.md` says how it is made. Never hand-edit a generated map.
- Developer docs: `docs/dev/` (how each part works), `docs/v2/SPEC.md` (the contract), `docs/v2/MODULES.md` (decisions and
  layouts), `docs/v2/PACKS.md` (the pack format). Where a doc and the code disagree, the code and its tests are right; fix
  the doc in the same change.

What a reader of this file can build:

| You want to | Write | Start at |
|---|---|---|
| Add a rule, a tracker or a screen's data to the story | a module | "How a module plugs in" and the worked example |
| Ship a world (places, routes, lore, a cast, events) | a world pack | "How a pack is written" and its example |
| Ship rules for a game (currency, calendar, weather, start) | a game pack | the same section |
| Change how the view looks | the UI layer | "The UI layer" |

## The folders

<!-- generated:folders -->
