# Story Suite Text RPG (example rules module)

A stand-alone RPG for **Story Suite** with no fight board: the narrator tells every fight, chase and
danger as prose, and code keeps the character honest. It is the second reference module after
[fishing](../fishing/README.md): fishing is a mini-game, this one is a **rules module that shapes the
narrator's prompt**. Like fishing it is a separate SillyTavern extension that talks to Story Suite
**only through its public sdk** (`globalThis.StoryBlock.ready`), and it imports nothing from Story Suite.

The one rule that keeps it stable: **the model judges and tells; the code rolls and keeps the books.**

Version `0.1.0`. Needs Story Suite 0.1.6 or later.

## Install

1. In SillyTavern open **Extensions** (the blocks icon) → **Install extension** and paste
   `https://github.com/kohz87/story-suite-text-rpg`. Story Suite must already be installed as `third-party/story_suite`
   (the manifest declares `"dependencies": ["third-party/story_suite"]`). Reload the page. (Without the installer: copy this folder
   into `public/scripts/extensions/third-party/story-suite-text-rpg/`.)
   That repository is a copy of `examples/text-rpg` in the Story Suite repository (https://github.com/kohz87/story_suite), where it is
   developed and tested; its tests live there.
2. In Story Suite's settings, on the **Start** page (the modules and their features), the **Text RPG** card appears (a module
   card named by the module, with one switch named **Text RPG**); turn it on. The feature declares `replaces:
   ['story-block.rpg']`, so the same action turns the **RPG** switch (in the Story Block card's Features) off, and turning
   the RPG on turns Text RPG off: a chat uses the RPG or Text RPG, never both (Text RPG is active only while its feature is
   on **and** `story-block.rpg` is off).
3. While it is on, **Settings › Rules › Text RPG** holds its settings: Tone, Survival (hunger, thirst and warmth),
   Stat names, in order, the Level cap (1 to 99) and the XP rate (50 to 300 %).
4. Open the **Party** tab and choose **Create your character**, as in the RPG: a name (it starts as your persona's), a
   starting level, or **Start from a saved character** (the file the Party tab's Export saves, the RPG's or this
   module's); every stat starts at 5 and you spend 10 points (a stat up to 10, 45 in all, one more point for each starting
   level above 1); and up to five skills (one more every tenth level, 8 at most). A character saved before the limit of 8 may hold more (up to 38): it keeps them and learns no more.
   The Party tab's **Export** on a character saves a file in the RPG's character file shape (so either module reads the
   other's), with this module's own part (xp, practice, injuries, conditions, each skill's exact type and cost) under
   `textRpg`, and the things the character carries (the party's bag for the main character, up to 60) and the purse (the main
   character's), as the RPG's file keeps them; the dialog's boxes leave either out, and Start from a saved character adds them back.

## Playing

- **The sheet.** Each reply the narrator is told, in words only, what each character can do
  ("Astra (Level 3) — STR very strong · AGI fast · Skills: Obscure (Adept): melts into shadow · Health: Hurt ·
  Mana: Steady · Stamina: Fresh (4 Obscure left)"). Numbers stay in the sheet and the Party tab.
- **Mana and Stamina.** Sized by the RPG's formulas: MP = 8 + level÷4 + (INT+WIS)÷4 and SP = 8 + level÷4 + (AGI+DEX)÷4, each term
  rounded down, from the stats with the points spent (stats 1..30, level 1..99). A level-up raises the size, a roll-back lowers it;
  what is left is a counter, read no higher than the size. Health is the five wound stages. A new level-1 character has 10 to 12.
- **Dice.** Before each reply the code draws three d20 from the reply's seed. At the moments that decide an
  outcome the narrator writes `? try Who | skill or stat | difficulty [| against: Group] [| edge: +1 (reason)]`; the code reads the verdict from the
  next die, the bonus and the difficulty, and the narrator tells that result. A swipe draws new dice; a Re-read keeps them.
  **The roll** is d20 + the skill's rank × 2 (Novice 0, Apprentice 2 … Legend 12). A skill the member does not have (a `? try` naming a skill
  that is not on the sheet) rolls −3; a plain stat try (`? try Astra | AGI`) is +0. Stats, gear and level are not in the roll. Each injury
  hampering the try's stat (a skill's stat) takes 2. A companion rolls +2 for a named strength, else +0.
  **Difficulty** has six words: trivial 5, easy 10, ordinary 15, hard 20, very hard 25, near impossible 30 (`normal` still reads as ordinary).
  While foes stand it starts from the threat of the strongest standing group (or the group `| against: Name` names): far beneath trivial, beneath easy, fair ordinary, above hard, far above very hard, beyond near impossible; the narrator's own word is ignored then (the receipt says so).
  With no foes standing the narrator's own word is the start. `| edge: +1 (reason)` makes it a step easier,
  `-2 (reason)` two harder; at most 2 either way, and a reason is required (without one the edge is ignored and the receipt says so).
  Live conditions and a drained body on a physical roll hold a floor under it (ordinary with the first, a step more for each further one); the tone
  then moves it: Standard (the default) none, Gritty one step harder, Heroic one easier. At the ends the shift is clamped, so under Gritty "very hard" and "near impossible" are both 30, and under Heroic "trivial" and "easy" are both 5 (the dice note lists the numbers). The receipt names the word rolled against.
- **Bands.** At or over the number: success. 1–2 short: success at a cost. 3–9 short: failure. 10 or more
  short: a bad failure. A natural 20 or 1 changes only the quality: a natural 20 that misses is still a miss (marked "well done"), a natural 1 that
  succeeds still succeeds (marked "clumsy"). In danger a failure adds one wound
  stage and a bad failure two (never past Badly wounded from one line); a costed skill spends MP or SP first.
  A success at a cost always costs: in danger one wound stage, out of danger the costed skill's cost again, else
  a step of stamina (a quarter of the pool, rounded up). The receipt's `data.paid` says which (`wound`, `skill`, `stamina`).
  A companion has no sheet, so nothing is paid from one.
- **Gear** is not in the roll and does not wear: a failed roll in danger asks the inventory for nothing. Worn gear still raises the sheet's stats and pools: its seven stats count by position, so a point of the gear's sixth stat (LUK) is a point of WIS, and the Bag's stat pickers and bonus text show your Stat names (WIS where the gear says LUK).
- **Foes and the matchup.** Before a fight the narrator sets the foes up with `+ foes Name | count: N | kind: <kind>` (up to 6 groups a reply; the same
  Name and kind in a later reply while some stand is reinforcements, shown as such (the same Name of another kind is a new group, "Wolves 2"); `- foes Name` ends a group that fled or scattered, with no XP). Groups do not expire by themselves, but they close when the story clock has moved a day or more since a reply last touched them (with no clock they stay), or when a `+ foes` names new foes in a reply after one that hit none of them; the narrator is told to end foes that fled or were left. The record is kept in the
  domain (`foes`: groups keyed by id, the remaining count a counter) and is part of replay. Each reply the code tells the narrator the **matchup**: the foes' weight
  (each group's remaining × its threat's weight: far beneath ⅒, beneath ¼, fair 1, above 2, far above 3, beyond 4) against the party's (each member who is not fallen or Down: 1 ×
  health factor Unhurt 1, Scratched .9, Hurt .7, Wounded .5, Badly wounded .25 × stamina factor Fresh and Steady 1, Low .8, Drained and Empty .6). The ratio
  is favoured (up to ½), even (up to 1½), outmatched (up to 4) or hopeless (above). It is in the tail with its rule and on the Rolls card ("Matchup: hopeless (Rats: vermin, minor for you (24), Astra wounded)": 24 × ¼ = 6 against a wounded hero's ½ is a ratio of 12);
  with no foes standing there is no matchup line.
  **The foe ladder.** The narrator writes only a kind: vermin (rats, stray dogs), common (bandit, wolf), trained (soldier, guard), elite (veteran knight, troll), monster (ogre chief, wyvern), legend (dragon). The code sets the **threat**
  from the kind and the party's level (the highest among members not fallen or Down): the kind's base (vermin 1, common 2, trained 3, elite 4, monster 5, legend 6) less the level band (levels 1–9: 0, 10–29: 1, 30–59: 2, 60+: 3), kept within 0..5
  (far beneath … beyond). The threat is fixed on the group when it is declared: a later level-up does not re-rate a standing group, and reinforcements keep it. It sets the starting difficulty of tries in the fight, the matchup weight, the XP and the lessons.
  It is shown in plain terms (far beneath "trivial for you", beneath "minor for you", fair "even for you", above "above you", far above "far above you", beyond "beyond you"): "Rats: vermin, minor for you (24)" on the Rolls card's Foes row and in the matchup line.
  **Battles.** A battle is a fight: from the first `+ foes` until none stand. A `+ foes` within 60 story minutes after the fight closed (with no story clock: in the reply right after) joins the same battle, which shares its XP cap and its lessons.
  **Old lines.** `threat:` on `+ foes` and `? try`, and `size:` on `+ xp`, are no longer honoured. A `+ foes` with no (known) kind is refused with the receipt "+ foes needs a kind: vermin, common, trained, elite, monster or legend", `threat:` on `? try` is ignored, and `size:` on `+ xp` is ignored (pay is per the foes record, or 10 XP with no record). A chat's earlier fights re-read under the kind rules: an old `+ foes` without a kind is refused, so its kills pay the no-record amount.
- **Practice.** Every use of a skill teaches: a `? try` +3 for a failure or a bad one, +5 for a success or a success at a cost, +10 for a success at hard or
  harder, 1 when the roll is trivial (a plain use); a roll is judged at the difficulty before an edge in the roller's favour, so a good ambush never costs practice (an edge against counts as rolled); a skill used with `~ spend` and no roll, or a one-session training scene, +1. Each is scaled by the threat word (far beneath ×0, beneath ×0.5, fair ×1, above ×1.5, far above or beyond ×2; none named ×1; rounded; every use teaches at least 1, even far beneath). A skill gains from `~ spend` or a one-session `~ train` once a reply between them, and a roll for it in the same reply wins.
  **A lesson** from a fight: `+ lesson Who — Skill | what was learned` teaches 5 × the fight's threat multiplier (far beneath 0, beneath ½, fair 1, above 2, far above 3, beyond 4; the strongest group that fell, not one that fled), once a skill a member a fight,
  only for a skill that member rolled while the fight stood, and only once all the fight's groups are down or gone (or in the reply they close). A fight is one set of foes groups.
  A skill's cost is paid once a reply when a `~ spend` and a `? try` both name it, in either order (the spend's receipt says "paid by the roll", the try's "cost already paid"); two tries each pay.
  `+ xp … | foes: N [| group: Name]` pays only up to the foes still standing in the foes record (all groups, lowest threat first, or the named group) and counts them down; with no record `foes:` is one at most. A reply with no roll pays nothing (the receipt says "no roll this reply: no XP") but still counts the foes down. Name the group when foes are mixed, or the lowest threat is paid first.
  **XP for foes:** each foe that fell pays its kind's base (vermin 5, common 10, trained 20, elite 40, monster 80, legend 160) × the group's threat multiplier (far beneath 0, beneath ½, fair 1, above 2, far above 3, beyond 4), rounded once a line, after the count (three foes at 2.5 each pay 8, not 3 × 3); a **battle's total is capped** by its strongest group's threat among the groups that had a foe fall or still stand (far beneath 0, beneath 25, fair 50, above 75, far above 100, beyond 200; the cap is scaled by the XP rate like the XP, so the numbers shown are granted ones): a foe that would pay past the cap pays what is left, and the receipt says "battle cap reached" (else "battle 30 of 50"). Foes that fled or were ended (`- foes`) pay nothing. With nothing standing and no battle current (none yet, or it closed more than 60 story minutes ago; with no clock, before the reply just after its close) a reply that had a successful roll pays 10 XP, else 0 (once a reply); while the battle stands or has just closed a `+ xp` pays 0 ("the battle is over; its XP was paid as the foes fell"). Known limit: in a chat with no story clock a new battle can start two replies after the last one, which resets the cap.
  **Training** is per session: `~ train Who — Skill | sessions: N` (one a day of training the story told; whole 1..60, missing or bad = 1) gives +1 a session (no threat scale), capped by the whole story days the clock moved since the reply began (at least 1; 1 when there is no clock; the dice step keeps the clock). Once a skill a reply; a roll of the same skill does not take sessions of 2 or more back; a single session (or one capped to 1 day) is a +1 use, and a roll of the same skill wins over it. Card: "Astra trained Swordplay: +30 (30 sessions)", or "(asked 30, story time 5 days)" when capped. Practice stops at 600. The receipts' `data.practice` says what was gained; the keyed
  counter `practice` stays a counter, and a per-reply mark (`spent`) keeps the once-a-reply rule through a swipe, a reload and a delete.
- **Rolls you can see.** Under a reply the module's one card `text-rpg-rolls` ("Rolls", up to 8 rows; it declares `rows: 8`) lists, from the reply's own receipts
  (`textRpg.rolls`), the matchup it was written under, the foes it set up, each roll, then what it earned; one row each: "Snap Cut, ordinary → a bad failure (2 + 0 vs 15) · a wound · practice +10"; a raised roll says why inside its
  difficulty ("hard (bleeding)"), a natural 20 or 1, an edge, a skill not on the sheet and a rank up are said briefly. The last row, "Earned", is the reply's xp, its lessons and the practice of its `~ spend` and `~ train`
  lines. With more rolls than the card holds the rest share one "and N more" row, so none is dropped. The card's tone is the worst band of the reply. A raised roll's receipt
  (`data.why`) and the dice note's floor line name the reasons: each live condition and a drained body.
- **Danger.** The threat is the standing foes' (see the foe ladder); with no foes it is this reply's earlier
  `? try`'s. The threat starts the difficulty. For danger (wounds) and practice the latest earlier reply's recorded threat counts too, else none (not in danger).
- **Limits.** Health is a stage counter `wounds` (0 Unhurt … 5 Down; the Party tab shows it as 5 − wounds of 5). Rest
  (`textRpg.rest`) refills stamina and mana; a full day heals one stage and ages injuries (3, 10 or 30 days). An injury
  made while the story has no clock has no end time (`heals: null`) and keeps until a day's rest with a clock starts its
  count; a timed condition made with no clock is held until `cleared`. A Down character cannot act; what happens to them
  is the story's call (`! fall Who — how` closes the sheet). If the reader's character has fallen, `textRpg.create`
  makes a new one (the fallen one keeps `pc: false`); while a living one exists it refuses.
- **Growth.** `+ xp Party — what [| foes: N] [| group: Name]` pays each foe that fell by its kind and threat, up to the battle's cap (`foes` a whole number 1 to 50; missing or bad is 1; only the foes standing in the foes record; see Foes and the matchup). A skill's rank follows its practice: Novice 0, Apprentice 40, Adept 100, Expert 180, Master 280, Grandmaster 420, Legend 600 (the cap), with no level gates; each
  level gives a stat point to spend on the Party tab, and a skill slot every tenth level (5 at the start, 8 at most, from
  level 30). Levels are the RPG's: 100 xp a level, 99 at most, xp held to 9999 (an xp stored past that counts as 9999 and is held there on the next `+ xp`; the kind pay and threat multipliers are this
  module's own). Level and points are derived: `xp` is the stored counter, level is what the xp reaches (`1 + floor(xp / 100)`);
  a character made at a higher level begins with that level's xp and its level points placed on the stats (`granted`: they
  are not left to spend). A stat bought with a point is a keyed, ordered
  purchase (`member.bought`: `{ stat, n, seq }`), not added into `stats` (the creation base); the level pays for the
  first purchases up to the points it earned, so a deleted xp reply takes the level, and the purchases it paid for,
  away, and a later level brings them back. Every reader uses the effective stats (`module-parts/effective.js`). Skills
  learned past the slots of the level (5, +1 every tenth level, 8 at most) stay listed but inactive, latest learned first; a `? try`
  with one is refused until the level returns.
- **Settings.** Tone (standard, the default, moves no roll; gritty makes every roll a step harder, heroic a step easier); Level cap (xp stops adding levels above
  it; default 99); XP rate (a percent, 50 to 300 in steps of 25, that multiplies what `+ xp` pays). Both are read when a
  reply's dice step is made and kept in that step's receipt (`rules`, only when not the defaults), so a Re-read, a middle
  delete or a reload pays the reply under the numbers it was written under, never today's settings.

## How it is built (the second reference module)

```
manifest.json            its own extension; "dependencies": ["third-party/story_suite"]
index.js                 await StoryBlock.ready → sdk.registerModule(textRpgModule(sdk))
src/words/               the word tables: stats, ranks, pools, foe kinds (pure)
src/rules/               the maths: difficulty, roll, harm, growth, level gains, healing (pure)
src/domain/              the `textRpg` domain: shape, validator, member ids (pure)
src/dice/                seeded dice, the dice record and the note told to the narrator (pure)
src/module-parts/        the module: definition, kinds, commands, queries, context, hook, settings
src/widget/              the new-character form as a widget
tests/                   node --test with the testkit host, plus hand-made ctx for the maths
```

**A rules module has four seams into the prompt**, all through the sdk's registration object:

1. **Capture kinds** (`capture.kinds` + `capture.apply`): the change lines the narrator may write
   (`? try`, `+ xp`, `+ foes`, `- foes`, `+ lesson`, `~ condition`, `+ injury`, `+ skill`, `+ companion`, `! fall`, `~ health`, `~ spend`). Each
   kind owns a one-line grammar that is in the static prompt only while the module is active, and an `apply(ctx, line)`
   that validates the line and writes the domain draft through the rules. Off means a quiet `FEATURE_OFF`.
2. **Context** (`context.static` and `context.tail`): the fixed rules text, and per reply the dice note first, then one
   capability line per member (so a tight budget cuts members, never the note). `budget` is 600 tokens.
3. **A prelude** (`hooks.beforeGenerate` → a command of cause `system`): `textRpg.dice` draws the reply's dice.
4. **Queries**: `rpg.sheet` and `party.levels` as **fallbacks** (`fallback: true`); `party.actors` and
   `party.newCharacter` (the `text-rpg/new-character` screen to open while no living member is the reader's, else null)
   as plain queries; and the module's own `textRpg.view` (the members' rows, the reader's id and that screen) and
   `textRpg.dice` (the latest dice step's `{ list, floor }`), `textRpg.rules` (the level cap and XP rate the settings say now: the
   wizard's starting level is held to the cap) and `textRpg.export` (one member's saved character file, which the Party tab's
   Export asks for). All answer the shapes the Party tab reads while Text RPG is active and `null` otherwise. A sheet row may
   carry `commands: { spend, skillEdit, export }` (`export` names the query).

**Replay == live.** Three choices keep swipes, Re-reads, middle deletes and reloads exact:

- The dice live in the **receipt data** of the `textRpg.dice` step, not in a place a Re-read can reorder
  (a Re-read puts a reply's system steps after its story lines). A normal send's step is kept on the carrier before
  the reply, a swipe's or regenerate's on the reply's own (`own: true`); a reply's `? try` lines take the step that went
  before them, so a Re-read of an earlier reply never reads a later reply's dice. They keep what they used (`used`,
  `hardest`, `threat`) in the domain under the reply's own record id.
- Down is its own mark (`down`), set only by `~ health … — Down` and cleared by any other `~ health` or a day's rest; the wounds counter reads 0 to 4. A capped wound replayed on a lower base can leave a member one stage healthier than a fresh telling.
- Numbers that move (`wounds`, mana and stamina, `xp`, practice) are declared `counters`, so a replay after a
  deleted reply adds each change instead of writing the number the deleted reply left. Nothing is a counter that is
  computed from another: level, points, effective stats and active skills come from `xp`, `granted` and `bought` on every read (`module-parts/standing.js`), and
  health is a stage count (a failed roll adds its stages, a day's rest takes one off, `~ health` is a set) that every
  read clamps to 0..5.
- The step is not re-planned (`replan` is off): a Re-read keeps the dice; a swipe is a new send, so a new seed.

**Honest limits.** One source of truth for a verdict: the dice note lists the difficulty numbers already moved by the
tone and the floor words, the narrator works each result out from it, and the code uses exactly those numbers (the standing foes' threat, else the narrator's word, starts it; the edge moves it; the floor holds it up; then the tone moves it). Two floor causes are not in the note: a drained character's physical
roll, and a condition the rolling character has when they are not the reader's. A skill's practice is a count in the member's
`practice` map (keyed by the skill's name, a declared counter), so deleting a middle reply takes its practice with it.
A timed condition (`until: N hours`) ends at the story minute it records; the tail, the floor and a `? try` read only
the live ones. A health stage (`~ health`) and a rest of mana and
stamina are sets (`ctx.absolute`), so they land where they say after a middle delete.

## Tests

`node --test "examples/text-rpg/tests/*.test.js"`. They run on the testkit host (a whole Story Suite host on a fake
SillyTavern), so nothing else is needed.

## Writing your own module

The step-by-step guide, with a 10-minute walk-through and every definition key (features and `replaces`, settings, Party tab queries,
plug-in screens, testing, installing), is [`docs/dev/writing-a-module.md`](../../docs/dev/writing-a-module.md). Its rule-first version for
coding assistants is the "Writing a plug-in module" part of [`AI-README.md`](../../AI-README.md). The first reference, a mini-game, is [Fishing](../fishing/README.md).
