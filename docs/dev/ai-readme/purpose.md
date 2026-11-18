## What this is

Story Suite is one SillyTavern extension for roleplay and story chats. It keeps the story's state (the scene, the bag, the
people, the clock, the world) as data next to the chat, shows it in a view of its own, and tells the model the parts that
matter on each reply. The reader's own words and the story stay in charge: state changes come from what the story says
(change lines the model writes) or from the reader's own clicks.

This file is the reference for a developer, or a developer's coding agent, who writes a **module** (code that plugs into the
host) or a **pack** (a plain-data world). Read it first, then the pointers in each section.

- Version `0.1.0`: one version number for the whole extension, written everywhere by `scripts/release.mjs`.
- Call the people module **NPC State** in anything a person reads. Its folder is `modules/people`.
- The code map is the way into the code: `docs/codemap.md` lists every file with its one job, its exports and its tests.
  `docs/dev/codemap.md` says how it is made. Never hand-edit a generated map.

## The folders

<!-- generated:folders -->
