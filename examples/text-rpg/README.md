# Story Suite Text RPG (example rules module)

A stand-alone RPG for **Story Suite** with no fight board: the narrator tells every fight, chase and
danger as prose, and code keeps the character honest. It is the second reference module after
[fishing](../fishing/README.md): fishing is a mini-game, this one is a **rules module that shapes the
narrator's prompt**. Like fishing it is a separate SillyTavern extension that talks to Story Suite
**only through its public sdk** (`globalThis.StoryBlock.ready`), and it imports nothing from Story Suite.

The one rule that keeps it stable: **the model judges and tells; the code rolls and keeps the books.**

Version `0.1.0`. Needs Story Suite 0.1.6 or later.

## Install

1. Copy this folder into SillyTavern as its own third-party extension, for example
   `public/scripts/extensions/third-party/story-suite-text-rpg/`, next to Story Suite
   (`third-party/story_suite`). The manifest declares `"dependencies": ["third-party/story_suite"]`.
2. In Story Suite's settings, on the **Start** page (the modules and their features), turn the **RPG** switch off. A chat
   uses the RPG or Text RPG, never both: Text RPG is active only while its feature is on **and** `story-block.rpg` is off.
3. On the same **Start** page the **Text RPG** card appears (a module card named by the module, with one switch named
   **Text RPG**); turn it on. Its three settings are labelled "Text RPG: Tone", "Text RPG: Survival (hunger, thirst and
   warmth)" and "Text RPG: Stat names, in order".
4. Open the **Party** tab and choose **Create your character**: a name, seven stats bought from 60 points
   (5 to 15 each) and up to five skills.

## Playing

- **The sheet.** Each reply the narrator is told, in words only, what each character can do
  ("Astra (Level 3) — STR very strong · AGI fast · Skills: Obscure (Adept): melts into shadow · Health: Hurt ·
  Mana: Steady · Stamina: Fresh (4 Obscure left)"). Numbers stay in the sheet and the Party tab.
- **Dice.** Before each reply the code draws three d20 from the reply's seed. At the moments that decide an
  outcome the narrator writes `? try Who | skill or stat | difficulty`; the code reads the verdict from the
  next die, the bonus (stat, gear, rank, level) and the difficulty, and the narrator tells that result.
  A swipe draws new dice; a Re-read keeps them.
- **Bands.** At or over the number: success. 1–2 short: success at a cost. 3–9 short: failure. 10 or more
  short or a natural 1: a bad failure. A natural 20: more than was asked. In danger a failure adds one wound
  stage and a bad failure two (never past Badly wounded from one line); a costed skill spends MP or SP first.
  A success at a cost always costs: in danger one wound stage, out of danger the costed skill's cost again, else
  a step of stamina (a quarter of the pool). The receipt's `data.paid` says which (`wound`, `skill`, `stamina`).
  A companion has no sheet, so nothing is paid from one.
- **Danger.** A `? try` line may carry `threat: how the foe compares`; without it the threat is this reply's earlier
  `? try`, else the latest earlier reply's recorded threat, else none (not in danger). The dice note says a threat raises
  the difficulty (above you → at least hard, far above → very hard, beyond → near impossible).
- **Limits.** Health is a stage counter `wounds` (0 Unhurt … 5 Down; the Party tab shows it as 5 − wounds of 5). Rest
  (`textRpg.rest`) refills stamina and mana; a full day heals one stage and ages injuries (3, 10 or 30 days). An injury
  made while the story has no clock has no end time (`heals: null`) and keeps until a day's rest with a clock starts its
  count; a timed condition made with no clock is held until `cleared`. A Down character cannot act; what happens to them
  is the story's call (`! fall Who — how` closes the sheet). If the reader's character has fallen, `textRpg.create`
  makes a new one (the fallen one keeps `pc: false`); while a living one exists it refuses.
- **Growth.** `+ xp Party — what | size: minor|real|major|great` pays by size, cut to what the reply's hardest
  roll supports and scaled by how the threat compares with the hero. A rank every 100 practice points; each
  level gives a stat point to spend on the Party tab, and a skill slot every third level. Level and points are
  derived: `xp` and `spent` are the stored counters, level is what the xp reaches and the points are what the level
  has earned less `spent`, so a deleted xp reply takes its level-up with it.
- **Settings.** Tone (gritty makes every roll a step harder, heroic a step easier).

## How it is built (the second reference module)

```
manifest.json            its own extension; "dependencies": ["third-party/story_suite"]
index.js                 await StoryBlock.ready → sdk.registerModule(textRpgModule(sdk))
src/words/               the word tables: stats, ranks, pools, threat (pure)
src/rules/               the maths: difficulty, roll, harm, growth, level gains, healing (pure)
src/domain/              the `textRpg` domain: shape, validator, member ids (pure)
src/dice/                seeded dice, the dice record and the note told to the narrator (pure)
src/module-parts/        the module: definition, kinds, commands, queries, context, hook, settings
src/widget/              the new-character form as a widget
tests/                   node --test with the testkit host, plus hand-made ctx for the maths
```

**A rules module has four seams into the prompt**, all through the sdk's registration object:

1. **Capture kinds** (`capture.kinds` + `capture.apply`): the change lines the narrator may write
   (`? try`, `+ xp`, `~ condition`, `+ injury`, `+ skill`, `+ companion`, `! fall`, `~ health`, `~ spend`). Each
   kind owns a one-line grammar that is in the static prompt only while the module is active, and an `apply(ctx, line)`
   that validates the line and writes the domain draft through the rules. Off means a quiet `FEATURE_OFF`.
2. **Context** (`context.static` and `context.tail`): the fixed rules text, and per reply the dice note first, then one
   capability line per member (so a tight budget cuts members, never the note). `budget` is 600 tokens.
3. **A prelude** (`hooks.beforeGenerate` → a command of cause `system`): `textRpg.dice` draws the reply's dice.
4. **Queries**: `rpg.sheet` and `party.levels` as **fallbacks** (`fallback: true`); `party.actors` and
   `party.newCharacter` (the `text-rpg/new-character` screen to open while no living member is the reader's, else null)
   as plain queries; and the module's own `textRpg.view` (the members' rows, the reader's id and that screen) and
   `textRpg.dice` (the latest dice step's `{ list, floor }`). All answer the shapes the Party tab reads while Text RPG
   is active and `null` otherwise. A sheet row may carry `commands: { spend, skillEdit }`.

**Replay == live.** Three choices keep swipes, Re-reads, middle deletes and reloads exact:

- The dice live in the **receipt data** of the `textRpg.dice` step, not in a place a Re-read can reorder
  (a Re-read puts a reply's system steps after its story lines). A normal send's step is kept on the carrier before
  the reply, a swipe's or regenerate's on the reply's own (`own: true`); a reply's `? try` lines take the step that went
  before them, so a Re-read of an earlier reply never reads a later reply's dice. They keep what they used (`used`,
  `hardest`, `threat`) in the domain under the reply's own record id.
- Down is its own mark (`down`), set only by `~ health … — Down` and cleared by any other `~ health` or a day's rest; the wounds counter reads 0 to 4. A capped wound replayed on a lower base can leave a member one stage healthier than a fresh telling.
- Numbers that move (`wounds`, mana and stamina, `xp`, `spent`, practice) are declared `counters`, so a replay after a
  deleted reply adds each change instead of writing the number the deleted reply left. Nothing is a counter that is
  computed from another: level and points come from `xp` and `spent` on every read (`module-parts/standing.js`), and
  health is a stage count (a failed roll adds its stages, a day's rest takes one off, `~ health` is a set) that every
  read clamps to 0..5.
- The step is not re-planned (`replan` is off): a Re-read keeps the dice; a swipe is a new send, so a new seed.

**Honest limits.** One source of truth for a verdict: the dice note lists the difficulty numbers already moved by the
tone and the floor words, the narrator works each result out from it, and the code uses exactly those numbers (a word is
raised to the floor first, then the tone moves it). Two floor causes are not in the note: a drained character's physical
roll, and a condition the rolling character has when they are not the reader's. The code also cuts an xp size the
rolls do not support. A skill's practice is a count in the member's
`practice` map (keyed by the skill's name, a declared counter), so deleting a middle reply takes its practice with it.
A timed condition (`until: N hours`) ends at the story minute it records; the tail, the floor and a `? try` read only
the live ones. A health stage (`~ health`) and a rest of mana and
stamina are sets (`ctx.absolute`), so they land where they say after a middle delete.

## Tests

`node --test "examples/text-rpg/tests/*.test.js"`. They run on the testkit host (a whole Story Suite host on a fake
SillyTavern), so nothing else is needed.
