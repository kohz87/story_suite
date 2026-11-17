# Interactions

An interaction is a scene a module shows (today only the fight board) where the reader makes choices, code settles the outcome from a fixed seed and the stored choices, and the narrator writes the next reply from a short settled note. Nothing the reader chose becomes story state until a reply carries it. The core owns the plumbing in `core/interaction/`; a module owns its screen, its rules and its note. The contract is SPEC §6.1; the decision is MODULES §F132.

## What is built

- **One kind today:** the fight board, `story-block/fight` (`modules/rpg/board/interaction.js`). No other module declares `interactions`. Fishing is a concept only; nothing of it is built.
- **The Combat Rules v1 engine** runs inside the same kind (setup `v1: 1`, docs/dev/fight-board.md). Every chat and every new sheet is Combat Rules v1 (there is no rules chooser: the block chooser, the New character wizard and a joining companion build v1 blocks), so a new fight plays on this engine; a setup made before it, or a chat that already holds an earlier Character, keeps the earlier engine until that engine is removed.
- **Both views choose the fight.** The old view chooses it on its Fight tab and in the waiting choice; the Suite view chooses it on its Fight tab, which is the activity host (`ui/tabs/scene/host.js`) with the fight renderer. The host has a renderer for no other kind yet; until it does, the core accepts `interactionStart` from `story-block/fight` only (`START_KINDS` in `core/interaction/start.js`); another kind's answer is dropped with a quiet Problem.

## How the Suite view shows an activity

There is no "Scene" tab for this (the word Scene stays for the world-state Here card and the Scene sheet). An open fight is shown on the Fight tab (`port.view('fight')`; the tab is there only while the fight is open, Now's "Needs you" card and the chat row's fight chip open it, and a sent or taken-back fight keeps the tab but stops asking for you). Any other open interaction is shown in a tab named after the activity: the interaction's `title`, or "Activity" when it has none (cut to 16 characters on the tab). That tab is there only while the interaction is open; only one interaction is open at a time, so the tab bar never grows past what a fight shows. Its frame (header, Send, Discard) is the host's; Send and Discard are the `interaction.send` and `interaction.discard` commands.

- **Your own view.** Register a renderer for your kind in `RENDERERS` in `ui/tabs/scene/host.js`, as Combat did for `story-block/fight`: `'your-module/kind': (vm, api) => node`. `vm` = { id, kindId, title, state, steps, canSend, canDiscard, view }, where `view` is whatever your kind's `view` returned. `api` = { stage(step), auto(n), send(), discard(), note, prefs }. Set `renderer.ownFrame = true` to draw your own header and Send / Discard (the fight does).
- **No renderer.** The generic renderer (`ui/tabs/scene/generic.js`) draws `view.lines` (text, at most 40) and `view.choices` (`{ id, label, actor }`, at most 12; a press stages one input for that actor) under a small "Basic view" note. It is a fallback so an activity is never invisible, not a design to ship.
- **Template page.** For module authors: Settings → Tools → Developer tools (a per-device switch, off by default) shows the generic renderer on a sample activity with the note "Template renderer: for module authors. Ship your own view for your activity." Nothing on it is sent. Players never see the sample.

## Pieces (`core/interaction/`)

| Piece | Files | Does |
|---|---|---|
| Contract | `contract.js`, `kind-name.js` | error codes, default limits, plain refusals, the kind id (`<moduleId>/<kind>`) |
| Policy | `policy.js`, `player.js`, `derive.js` | who the reader may choose for (below); derived inputs for everyone else |
| Dice | `dice.js` | the seed and one positional dice stream per step |
| Session | `session.js`, `send.js`, `carry.js`, `reconcile.js`, `view.js`, `preview.js`, `prior.js`, `pick.js` | the unsent session, the Send copy, the next segment of a long interaction, reconcile after a head move, the `interaction.view` query |
| Settle | `settle.js`, `guard.js` | the prelude command `interaction.settle` and its replay guard |
| Turn wiring | `hooks.js`, `held.js`, `start.js`, `start-hold.js`, `watch.js` | hold the send, the waiting choice, a held reply, the in-flight watch |
| Prompt | `note.js`, `markers.js` | the settled note and its allowance; the history marker lines |

The sdk is `sdk.interaction` (`core/sdk/interaction.js`, `version: 1`): `open`, `stage`, `auto`, `send`, `discard`, `current`. Every call answers `{ ok: true, … }` or `{ ok: false, code, message }` and never throws. `sdk.modules()` lists a module's kinds as `interactions`.

## Lifecycle

1. **Open** on the head reply (`anchor` = its `sid`) with a seed from `(anchor, attempt, kindId)`; one open interaction per chat (`BUSY`).
2. **Stage** a step (one input per actor the reader chooses for): policy, then the kind's `validate`, then `play` for the preview. The first stage of a segment records the setup witness, the player and the policy.
3. **Send.** The staged session is copied beside the waiting message and the reply is generated. While steps are staged and not sent, a normal generate is held ("Play the waiting …").
4. **Settle.** `interaction.settle` is a prelude of the reply: it checks the witness and the recorded policy, derives the code-played inputs, runs `play` + `settle` with the stored seed, claims `ia:<kind>:<key>:reply:<sid>`, records the guard and runs the kind's `changes` as commands. Only `system` steps reach it; a screen cannot call it. Its receipt keeps the result under `data.v2.result` and a display list under `data.interaction`.
5. **Carry.** A kind with `carry` and a result that stops `open` opens the next segment on the new reply.

## Who chooses (the story-action policy)

`STORY_ACTION_POLICY` in `core/interaction/policy.js` is the only place the rule lives (CLAUDE.md non-negotiable 9). The reader chooses for their own character; a kind in `partyKinds` lets them choose for every party member. Fights are in `partyKinds` permanently (owner, 16 Nov 2026). Everyone else is played by the kind's `auto` (derived on every preview, send check, settle and replay, never stored) or left to the narrator reading the note. A stored input for an actor the recorded policy does not allow is `NOT_YOURS`. The policy in force and the player's actor id are recorded at the first stage and replayed from the settle payload, so a persona rename or a later policy edit changes only interactions opened after it.

## What each turn event does

| Event | Effect |
|---|---|
| swipe | the reply's own earlier settle payload is replayed: same seed, steps, witness, result |
| regenerate | staged session, then Send copy, then last payload (only when the reader's message is linked to that key, `extra.storySuiteInteractionLinks`) |
| delete (last reply) | its receipt goes; the session goes back to its `base` with no steps staged, or is marked `invalidated` ("The earlier … was taken back") with steps |
| middle delete | the store rebuilds; the guard checks the prefix; on a mismatch `planAgain` settles again from the stored payload: the same result, a new one, or `NO_LONGER_DONE` (the Problem `INTERACTION_TAKEN_BACK`) |
| rewind, save-point restore | settle blocks whose guard no longer holds stay stored and inactive and do not refuse the rewind; the session is reconciled against the surviving receipts |
| reload | metadata survives; a held reply restores its hold with a Problem |
| Re-read | refused on a held reply; otherwise settle is re-planned from the stored payload; a staged session on the anchor is kept (a changed witness makes the next stage answer `CHANGED`) |
| chat change, branch | sessions, waiting choices and held markers whose reply is gone are pruned |

An edited Re-read re-plans from the stored payload and witness, so growing or shrinking the reply's lines does not move the settle.

## Storage

- Scratch (not game state, reconciled on every head move): `chatMetadata.storySuiteInteraction = { open, start, attempts, send, last, held, heldDiscarded }`; `message.extra.storySuiteInteractionLinks[key]`.
- Replayed: the settle receipt's `replan.payload` (seed, steps, setup, witness, recorded player and policy; kept forever) and the ops of the commands it called.
- Kept after 200 carriers: `data.v2.result` (readers find a settle by `type` + `replan.payload.kindId`). `data.interaction` is display only and may be dropped; the card then shows the receipt's `summary` line only.
- The guard mark gains `;kinds:<kindId>@<module version>:<ready 0|1>,…` for registered kinds; with none registered it is what it was.

## Prompt

- The settled note is the receipt's `summary` (`note(...)` joined with ` | `), a kept prelude cue joining the leading `[Happened]` note (`cue.interaction`). It adds no static text.
- **Allowance:** `INTERACTION_NOTE_TOKENS` = 1290 (`note.js`: the longest board note, 4 heroes v 6 foes over 4 exchanges, 1071 tokens over 300 seeds, plus 20 %), pinned by `tests/core/interaction/note-budget.test.js`. A longer note is never cut: it is sent whole and raises the quiet Problem `NOTE_LONG`.
- **Marker:** a kind declares one word (`[battle]`); `stripMarkers` drops those lines from the prompt history. The board's marker is gated on the RPG feature, as before.

## The gate

`scripts/checks/core-module-refs.mjs` (in `npm run check` and CI) fails when the core's turn, prompt, sdk, registry, commands, interaction or old-view host code names `lean-rpg`, `board`, `fight`, `RPG_` or `rpgLib` on a line that `docs/merge/core-module-refs.txt` does not list. The list only shrinks. What it still holds is a debt, by reason: the lazy RPG loader and its wait; the pre-port compatibility lines (until C11); the old-view wording "Open fight board" and the host's RPG screens; `partyKinds`, `START_KINDS` and the board seed line (owner's Q1, the board-only chooser until the scene host, the seed rule until C6); and the board-named stop (`boardStop`, `stopChangedBoard`) still passed through the turn.

## Tests

`tests/core/interaction/` (a probe kind in `helpers/`, one `flow-*` test per lifecycle row), `tests/core/qa` (the fuzzers include the probe kind), `tests/scripts/core-module-refs.test.js` (the gate).
