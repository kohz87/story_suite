## Combat Rules v1 and the fight board

The fight board is the one interaction kind built (`story-block/fight`, declared in `modules/rpg/board/interaction.js`), and
Combat Rules v1 is the only engine (`modules/rpg/combat/`, entry `modules/rpg/combat/play.js#playBoard`). The narrator tells
the story and starts a fight by setting a foe slot; the reader stages each exchange on the Fight tab (for every party
member), and code plays every blow from a stored seed (`modules/rpg/combat/dice.js`, the port's `dice(seed, offset)`). The
narrator then gets a short settled note. There is no narrated fight, roll planner or rules chooser; `docs/dev/fight-board.md`
has the design (read its C11 paragraph first: the older sections describe the removed engine).

**Marks: new fights get the new rules, old fights replay as recorded.** A rule change that would move an old result is
switched on by a mark on the fight's setup, written when the fight opens (`modules/rpg/board/v1-kind.js`), stored with the
fight's receipt, and read back on replay. A fight opened before a mark has none and plays exactly as it did, so replay still
equals live. The marks today:

| Mark | What it does when set |
|---|---|
| `fleeIdle` | a member who picked nothing pays no stance in an exchange where the party flees and gets away |
| `xpRule` | how a win pays: absent, per group; `'each'`, 15 for each foe; `'each2'`, the same with a mob paying a quarter and a minion half (`modules/rpg/combat/rewards.js#winXp`) |
| `gearStats` | the stats of worn gear count in every roll and in the log (`modules/rpg/board/v1-kind.js`), read live like soak |
| `speedFull` | a Speed stance adds its full skill mastery to evasion, not half (`modules/rpg/combat/rolls.js#playerRoll`) |
| `soakWhole` | soak takes off only the whole points it adds up to, so a small hit through low soak is not cut by one (`modules/rpg/combat/damage.js#takeHit`) |
| `gearWear` | a decisive hit taken wears the body armour (else the shield) and a decisive miss wears the weapon, one step, and the narrator is told (`modules/rpg/board/v1-wear.js`) |

To change a combat rule: add a mark, write it where the setup is built, read it where the rule applies with the old
behaviour as the default, and add a test that an old setup (without the mark) still gives its recorded result and a new one
the new result. Never change a rule for old setups. A fight is also sized by code (the pre-check keeps a tier and cuts it to
at most 4 standard foes, or 3 of an elite group; extra foes come in a tier lower) and pays XP and practice in the settle
(`modules/rpg/board/v1-award.js`).

## NPC State and one-pass capture

NPC State (`modules/people`) keeps a dossier for each person in the story: role, look, mood, goal, status, where they are, memories,
relationships, abilities and keepsakes. Its module is `modules/people/module.js` (`PEOPLE_MODULE_ID`), registered last.

**One-pass capture** means the same reply that tells the story also carries the NPC State changes: no second model call per
reply. Its rules go into the static prompt under the key `story_suite_static_people` (byte-identical every reply, so the cache
holds; the golden test pins that key in the scenarios where the capture is on), and its context and reminder (who is in the
scene) go in their own system message at the very end of the prompt, depth 0 (`modules/people/runtime/runtime-injection.js`). The model writes people's changes as lines inside the same `<Changes>` block, `~ npc Name | mood: alarmed`,
`+ npc Name | role | look`, `~ npc Name | learns: …`, `~ memory Name | …`, and the capture step hands them to NPC State like any
other kind. The rules text is built by `modules/people/core/core-prompts-lines.js#buildLinesParts`. A line that is wrong is
refused alone; the others still run. The host knows the capture is on when that static key is set
(`core/turn/prompt-hooks.js`). A slower pass later fills in a person's full profile from several scenes.

NPC State wording is the owner's: do not change a sentence of its prompt without approval, and say the golden changed.
