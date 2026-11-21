## Concepts

- **Chat state.** Everything the story knows lives in the chat store (`core/store.js`) as domains of plain JSON, one module
  owning each domain. Only that module's commands write it. State is saved with the chat (`core/persist.js`;
  `docs/dev/saves-and-persist.md`).
- **Replies carry their changes.** Each reply holds the receipts of the commands that ran on it. State at any point is the
  starting state plus the receipts of the replies up to there, so a swipe, a swipe back, a deleted reply in the middle, a
  rewind and a reload all give the same state as live play. This is the **replay == live** rule; `core/replay.js` and
  `docs/v2/REPLAY.md` hold the contract. A command whose result depends on something outside the state (the clock, another
  reply, a roll) either takes it from the receipt's seed (`ctx.rng`, `ctx.roll`) or records a guard that is checked again on
  replay.
- **Change lines and the `<Changes>` block.** The model ends a reply with one hidden block, `<Changes>` … `</Changes>`
  (`<Changes></Changes>` when nothing changed), with one short line for each change: `op kind Name[ — text][ | label: value]`.
  The first mark of a line says how (table below); the capture step (`core/capture.js`) hands each line to the module that
  owns its kind, which turns it into a command run with cause `story`. A line a module refuses is told to the reader as a
  Problem and changes nothing; the others still run. `docs/dev/capture-and-reread.md` covers Re-read, including an edited
  Re-read, and the optional extractor that repairs a reply with no block.
- **Commands and queries.** A command is the only way to change state; it runs in one transaction on the bus
  (`core/commands.js`) and either commits all of it as a receipt or none. A query reads state and never writes. Modules call
  each other's commands and queries by name (`ctx.call`, `ctx.query`), never each other's code. A command has a cause:
  `story` (a change line), `ui` (the reader's click, through `sdk.command`) or `system` (the host's own steps, such as a
  hook before a reply).
- **Prompt.** Each module may give a fixed text (static), a changing text (tail) and a budget; the host assembles them
  (`core/prompt.js`; `docs/dev/prompt-and-context.md`). The static part depends only on the code and the reader's feature
  switches, so it is byte-identical from reply to reply (the model's cache keeps it), and the whole static prompt is pinned
  by `tests/suite/static-prompt.golden.json`. A reply also ends with a fixed cue to write the `<Changes>` block
  (`core/turn/text-parts/closing-cue.js`).
- **Story-driven.** The reader acts through the story. The one door for a story action from the UI is the interaction port
  (`core/interaction.js`): a module declares an interaction kind (today only the fight board), the reader stages choices on
  its screen, code settles the outcome from a stored seed and those choices, and the narrator writes the next reply from a
  short settled note. The one policy of who may choose is `STORY_ACTION_POLICY` in `core/interaction/policy.js#STORY_ACTION_POLICY`:
  the reader chooses for their own character, and for every party member in a fight; anyone else is played by the kind's
  `auto` or left to the narrator. `docs/dev/interaction.md` has the lifecycle (open, stage, send, settle, carry) and what each
  turn event (swipe, regenerate, delete, rewind, reload, Re-read) does to it.
- **Features.** A module marks parts of itself with a feature id; the reader can switch the feature off. A feature that is
  off leaves no trace: no prompt text, no hooks, no cards, its queries answer `null` and its commands are refused.
- **Packs and data modules.** Content (places, lore, a cast, a calendar) comes from packs, plain data that code reads
  through queries. Small rule sets can also be written as data modules inside a game pack and run by the host
  (`modules/data-modules/`, `docs/v2/DATA_MODULES.md`); they need no code from you.

## Change lines and commands

<!-- generated:commands -->

Kinds are the module's to name. The grammar line of each kind is part of the static prompt, so a new kind, or new wording of
an old one, changes the golden prompt: do it on purpose, with review.
