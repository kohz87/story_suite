# Story Suite Text RPG (example rules module)

A stand-alone RPG for **Story Block v2** with no fight board: the narrator tells every fight, chase and
danger as prose, and code keeps the character honest. It is the second reference module after
[fishing](../fishing/README.md): fishing is a mini-game, this one is a **rules module that shapes the
narrator's prompt**. Like fishing it is a separate SillyTavern extension that talks to Story Block
**only through its public sdk** (`globalThis.StoryBlock.ready`), and it imports nothing from Story Suite.

The one rule that keeps it stable: **the model judges and tells; the code rolls and keeps the books.**

Version `2.0.0-alpha.1`. Needs Story Block v2.

## Install

1. Copy this folder into SillyTavern as its own third-party extension, for example
   `public/scripts/extensions/third-party/story-suite-text-rpg/`, next to Story Block
   (`third-party/Story_block`). The manifest declares `"dependencies": ["third-party/Story_block"]`.
2. In Story Suite's settings turn **RPG** off (Settings → RPG). A chat uses the RPG or Text RPG, never both:
   Text RPG is active only while its feature is on **and** `story-block.rpg` is off.
3. Turn **Text RPG** on (Settings → Features).
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
  short or a natural 1: a bad failure. A natural 20: more than was asked. In danger a failure costs one health
  stage and a bad failure two; a costed skill spends MP or SP first.
- **Limits.** Health is a stage word (Unhurt … Down). Rest (`textRpg.rest`) refills stamina and mana; a full
  day heals one stage and ages injuries (3, 10 or 30 days). A Down character cannot act; what happens to them
  is the story's call (`! fall Who — how` closes the sheet).
- **Growth.** `+ xp Party — what | size: minor|real|major|great` pays by size, cut to what the reply's hardest
  roll supports and scaled by how the threat compares with the hero. A rank every 100 practice points; each
  level gives a stat point to spend on the Party tab, and a skill slot every third level.
- **Settings.** Tone (gritty makes every roll a step harder, heroic a step easier).

## How it is built (the second reference module)

```
manifest.json            its own extension; "dependencies": ["third-party/Story_block"]
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
2. **Context** (`context.static` and `context.tail`): the fixed rules text, and per reply one capability line
   per member and the dice note. `budget` is about 300 tokens.
3. **A prelude** (`hooks.beforeGenerate` → a command of cause `system`): `textRpg.dice` draws the reply's dice.
4. **Queries**: `rpg.sheet` and `party.levels` as **fallbacks** (`fallback: true`) and `party.actors` as a plain
   query, all answering the shapes the Party tab reads while Text RPG is active and `null` otherwise. A sheet row may
   carry `commands: { spend, skillEdit }`, and the answer names the `text-rpg/new-character` screen while no
   member is the reader's.

**Replay == live.** Three choices keep swipes, Re-reads, middle deletes and reloads exact:

- The dice live in the **receipt data** of the `textRpg.dice` step, not in a place a Re-read can reorder
  (a Re-read puts a reply's system steps after its story lines). A normal send's step is kept on the carrier before
  the reply, a swipe's or regenerate's on the reply's own (`own: true`); a reply's `? try` lines take the step that went
  before them, so a Re-read of an earlier reply never reads a later reply's dice. They keep what they used (`used`,
  `hardest`, `threat`) in the domain under the reply's own record id.
- Numbers that move (pools, xp, points, level) are declared `counters`, so a replay after a deleted reply adds each
  change instead of writing the number the deleted reply left.
- The step is not re-planned (`replan` is off): a Re-read keeps the dice; a swipe is a new send, so a new seed.

**Honest limits.** The narrator sees the dice when it names a difficulty. The code narrows that: it computes the
verdict itself, raises a lower difficulty to a floor it tracks (threat, conditions, fatigue), and cuts an xp size the
rolls do not support. A skill's practice is a count in the member's
`practice` map (keyed by the skill's name, a declared counter), so deleting a middle reply takes its practice with it.
A timed condition (`until: N hours`) ends at the story minute it records; the tail, the floor and a `? try` read only
the live ones. A health stage (`~ health`) and a rest are
sets (`ctx.absolute`), so they land where they say after a middle delete.

## Tests

`node --test "examples/text-rpg/tests/*.test.js"`. They run on the testkit host (a whole Story Block host on a fake
SillyTavern), so nothing else is needed.
