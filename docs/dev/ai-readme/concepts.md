## Concepts

- **Chat state.** Everything the story knows lives in the chat store (`core/store.js`) as domains of plain JSON, one module
  owning each domain. Only that module's commands write it. State is saved with the chat (`core/persist.js`;
  `docs/dev/saves-and-persist.md`).
- **Replies carry their changes.** Each reply holds the receipts of the commands that ran on it. State at any point is the
  starting state plus the receipts of the replies up to there, so a swipe, a swipe back, a deleted reply in the middle, a
  rewind and a reload all give the same state as live play. This is the **replay == live** rule; `core/replay.js` and
  `docs/v2/REPLAY.md` hold the contract.
- **Change lines.** The model ends a reply with short lines that say what changed. The first mark of a line says how
  (table below); the capture step (`core/capture.js`) hands each line to the module that owns its kind, which turns it into a
  command. A line a module refuses is told to the reader and changes nothing. `docs/dev/capture-and-reread.md` covers
  Re-read, including an edited Re-read.
- **Commands and queries.** A command is the only way to change state; it runs in one transaction on the bus
  (`core/commands.js`) and either commits all of it as a receipt or none. A query reads state and never writes. Modules call
  each other's commands and queries by name, never each other's code.
- **Prompt.** Each module may give a fixed text (static), a changing text (tail) and a budget; the host assembles them
  (`core/prompt.js`; `docs/dev/prompt-and-context.md`). The whole static prompt is pinned by
  `tests/suite/static-prompt.golden.json`.
- **Story-driven.** The reader acts through the story. The one door for a story action from the UI is the interaction port
  (`core/interaction.js`, policy in `core/interaction/policy.js`).

## Change lines and commands

<!-- generated:commands -->
