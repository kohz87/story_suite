## How a module plugs in

A module is a folder `modules/<name>/` that exports one definition. The registry (`core/registry.js`) checks it when it
registers and refuses it, with a plain sentence, if it breaks a rule. The definition names what the module owns; the host
does the rest.

- **Domains.** The state the module owns: a name, an `initial()` and a validator. One owner per domain.
- **Commands.** The module's writes. A handler reads frozen copies, changes drafts of its own domains, may call other
  modules' commands in the same transaction, and returns a summary. If anything throws, nothing is kept.
- **Queries.** Reads other modules and the view may call. They answer `null` when the module is off.
- **Kinds.** The change-line kinds the module captures from a reply, each with its grammar and the command it runs.
- **Context.** `static`, `tail` and `budget` for the prompt.
- **Hooks.** Steps the host calls at fixed points (before a reply is generated, after one is captured, and a replay guard).
- **Settings, features and tabs.** What the module adds to Settings, the switches the reader can turn off, and the tabs or
  cards it shows. A feature that is off leaves no trace: no prompt text, no hooks, no cards.
- **Peers.** `requires` may name other modules it needs. A module whose peer is missing or off is dormant, with its names
  kept reserved.

Rules of thumb for a new module:

1. Start from a small existing one, such as `modules/time`, and read its header comment, then its parts.
2. Take the host's services from the SDK, never from SillyTavern directly; `docs/v2/PUBLIC-API.md` is the surface other
   extensions get.
3. Put a model call behind the SDK's model call (`core/model-call.js`) so profiles, queues and the safety net apply.
4. Write the replay tests with the module (swipe, swipe back, middle delete, rewind, reload).
5. Add its files to `docs/codemap/jobs.json` and run `npm run codemap`.

Detail: `docs/v2/MODULES.md` (layouts and decisions), `docs/v2/LIFECYCLE.md` (peers and restore),
`docs/v2/EVIDENCE.md` and `docs/v2/REPLAY.md` (guarded blocks).

## The module SDK

<!-- generated:sdk -->
