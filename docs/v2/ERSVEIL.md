# Playing v2 in Ersveil

Ersveil is a world of two format 4 packs:

* the **world pack** `ersveil` 4.0.0 ([`examples/packs/ersveil/pack.json`](../../examples/packs/ersveil/pack.json)): the lore, 320 places, 352 routes, 103 world events, 31 people (12 of them companions with portraits) and the start;
* the **game pack** `ersveil-game` 1.2.0, "Ersveil rules" ([`examples/packs/ersveil-game/pack.json`](../../examples/packs/ersveil-game/pack.json)): the calendar, the coins, the weather, the Guild rank, the RPG skill set and four data modules (three, and Your Holding, which is off until you turn it on).

`examples/packs/ersveil.zip` holds both (`pack.json`, `game.json`, the twelve portraits and `CONVERSION-NOTES.md`). The packs are edited directly and the zip is built by `node scripts/core/build-example-zip.mjs`. A story begins at Bluewatch Village, in the Guild Office, with 40 copper ("4 silver").

The world pack needs Story Suite 0.1 (`requires.suite: "^0.1"`) and the `chronicle-lasting` capability. It has **no shops, prices, foes, jobs, classes or rules**: the narrator makes those up from the lore, and Story Block keeps what the story hands out (the bag, the purse, the place). NPC State is optional.

## 1. Extensions

Install Story Block and Story Director (SillyTavern → Extensions → Install extension: paste the URL). NPC State Delta is optional. If you have the v1 versions installed, remove them first or use a separate SillyTavern profile.

| Extension | URL |
|---|---|
| Story Block (the host) | https://github.com/kohz87/Story_block |
| Story Director | https://github.com/kohz87/Story_director |
| NPC State Delta (optional) | https://github.com/kohz87/npc_state_delta |

## 2. Set up a chat

1. **Install the pair.** In Settings › Packs, press **Import a pack file**. Pick `ersveil.zip` (it holds both packs and the twelve portraits). Or import `pack.json` first, then `game.json`. A file picked alone brings no portraits.
2. **Pick World and Game.** Under **World and game**, set World to "Ersveil (open world)" and Game to "Ersveil rules". The world suggests that game, so a card may offer **Use it**.
3. **Create the lorebook.** With a chat with your narrator card open (below), press **Create the lorebook from this pack** on the Ersveil row, keep **Use with this character** ticked and confirm. This makes the SillyTavern book "Ersveil (open world) (Story Suite)" from the pack's lore and attaches it to that character: linked as its lorebook, or added to its lorebooks when the card has its own. Every chat with the card reads it; the chat lorebook is left alone. See [PACKS.md](PACKS.md), "Lore and the lorebook".
4. **Start a new chat.** A chat takes the world and game it begins with and keeps that choice.

Add a narrator card (for example `Ersveil`: "{{char}} narrates Ersveil and plays every person in it except {{user}}.") and your own persona. The first message is your own opening in Bluewatch Village. The RPG starts you at level 1 unless you set a starting level.

## 3. The lore

The world pack holds 218 lore entries. 213 are in the lorebook. Five are **hidden** and are left out of it. The narrator reads the book through SillyTavern; four entries are always on and the rest come when their keys appear in the story. The lore is the world as it stands when the story starts. What happens later comes from the story and its events, which win over the lore.

The five hidden entries (the Iron Archive, the shared root of Church and Veil, Startrace's northern tap, the Emperor's chamber, and after the Last Wall) open only when their gate holds, and only with World events on. Nothing on this page spoils them.

Pick **Update the lorebook** after a new pack version: it replaces that book and only that one.

## 4. The data modules

Importing the packs yourself turns none of them on. A card's **Install** turns on all but Your Holding in that chat. To turn one on yourself, open Settings › Setup › **Packs and trackers**, find **Data modules in this chat** and use the module's switch; it then stays on for that chat.

| Module | What it keeps |
|---|---|
| Standing with the powers | Your standing, -100 to 100, with each of ten powers (kinds `gain` and `loss`). Section: Standing with the powers (Reputation tab). |
| Fame by region | How well known you are, 0 to 100, in each of sixteen regions (kinds `deed` and `spread`). Section: Fame by region (Reputation tab). |
| Adventurer Guild membership | Registration, your letter (F to S), dues and years as a member (kinds `register`, `dues`, `contract`, `promote`, `yearend`). Section: Adventurer Guild (Reputation tab). |
| Your Holding | Your own company, fief or trading house: seat, people, treasury, renown, loyalty, tier, upkeep and officer posts. Section: Holding tab. |

**Your Holding is off until you turn it on.** While it is off, the narrator is told nothing about it, there is no monthly reminder, and world events learn nothing of a holding. When your story heads that way, use its switch as above. After that, say in the story that you found it. A month line pays the upkeep; a paid month gives +2 loyalty (up to 100), an unpaid one costs 15. A second month line in the same story month charges again.

**Officer posts.** Once the holding has a seat, the story can give a post (steward, marshal, spymaster, healer or chaplain, quartermaster, envoy) to someone it knows who stays at the seat and does not travel with you: say it in the story, for example "Mara stays at Ravenhold as steward". One person holds a post, and one post per person. The post is freed when the story takes it back, or when its holder travels with you again or dies.

Once a module is on the narrator is told its `dm …` lines; a refused line changes nothing. See [DATA_MODULES.md](DATA_MODULES.md).

## 5. Playing

* **Start.** Bluewatch Village / Guild Office, with **40 copper** and an empty bag: the pack has no items, so the story gives your kit (`+ item Bedroll`, `+ item Knife`).
* **Clock.** The calendar is the game pack's: era `CY`, the twelve months of the Gregorian year. The story starts on **CY 611, October 1, 07:00**. The first reply shows the date.
* **Coins.** Copper (1), silver (10) and gold (100). The wallet counts copper and the narrator may write `+ coin 3 silver`. Prices come from the lore's wages and prices; the story decides what a reply pays.
* **Items, shops and foes** are made in the story: `+ item Rope | qty: 1`, `- item Rope`, a merchant the narrator names, a beast from the lore's bestiary.
* **Map.** Story Director's Map and Region list show the 320 places; the story moves you with `~ place Bluewatch Village`. Routes give the distances.
* **Events.** The world has a hidden history from CY 611 onward (103 world events): floods out of the north, politics, war and the underworld, on their own dates whether or not you are there. When something happens where you are, the narrator gets the scene; elsewhere, word reaches you days or weeks later as news. **Settings › Diagnostics › Events** lists every event, and does spoil it.
* **RPG.** With the RPG on (Settings › RPG), the New character window offers the game pack's **Sealwarden recruit** skill set: Gate spear, Ward-reading, Lamp-keeping, Breach drill and Gate challenge. The level cap is 99.
* **Ranks.** The rank bands name a foe's level band: F for levels 1 to 9, E 10 to 19, D 20 to 29, C 30 to 39, B 40 to 49, A 50 to 59, S 60 to 69, SS 70 to 79 and SSS 80 to 99. A foe reads "Rank F · Lv 7". Your Guild rank label is "Guild rank".

### The twelve

The cast has 31 people. Twelve are companions, each with a portrait. They are met by place or because what they want pulls them to the party. What each one hides opens as Trust or Affection grows or when the story reaches it; none of it is told before.

| Person | Where they begin | One line |
|---|---|---|
| Sister Temiwa | Bluewatch Village | A dogfolk saintess candidate exiled to the frontier, a shy, soft, weary, dryly sarcastic healer who keeps the dead at rest. |
| Ysmeth | Shackles City / Chainmarket | A dwelf rune-collar artificer held by the Grey Ledger, cold, exact and planning every exit. |
| Nysseth | Shackles City / Knifeglass Alley | A soft-spoken, sweet, obsessively devoted elf who runs a Broken Chain cell from a knife-grinder's stall and teaches by asking what you missed. |
| Rika | Auvoth / Pale Market | A white-haired barge-girl mage with huge, unrefined power who cannot read and will not say so. |
| Harrak | Varnhold Watch | The orc captain of the Long Watch, old and tired, who sings while he fights. |
| Torka | Bluewatch Village | A loud, hot-blooded young orc berserker hunting the Wildzone for a deed-name. |
| Sir Lothar | Highmark Capital | A gentle, poetic Iron Guard knight sworn to Princess Wendhild. |
| Gorm Kettlebright | Highmark Capital | Ardelia's jolly, hugging envoy, who plays the fool because fools hear everything. |
| Nerissa | Abysswatch | A sunny, clingy-sweet, still prankish Atlantean pilot of the privateer Gannet, called a deserter by her own people. |
| Hush | Vargate | A spirit of silver rain who lights the night lamps and guides the lost. |
| Asphodel | Corrowen | A calm, watchful stranger who sells secrets in the harbor taverns. |
| Barney Thimblewick | Thousand Sails | A halfling barge gambler and con man, the cast's grandfather figure (not a romance). |

The eleven who can be romanced use NPC State Delta's companion meters (Trust, Affection, Desire, Tension); Barney uses the mentor's, with no Desire. Everyone starts at 0 on every meter. A relationship is built in play, not given at the first meeting.

## 6. Updating the pack

Import the new file (same id `ersveil`: it replaces the old one and keeps its switch), press **Update the lorebook**, then start a new chat. When you change a value in the pack, keep this page, `tests/v2/packs/ersveil-pack.test.js`, `tests/v2/packs/ersveil-timeline.test.js` and the pack's version in step.

## Old format 3 Ersveil (test fixture)

The older Ersveil 3.0.0 (pack format 3) is a frozen test fixture in `tests/fixtures/packs/ersveil-3`: `pack.json`, `ersveil.zip` and a hand-made lorebook `ersveil-lore.json` (227 entries). Format 3 packs are refused by the validator, so it is not for play. Its lorebook imported through SillyTavern → World Info → **Import World Info**; the new lorebook comes from the pack instead.
