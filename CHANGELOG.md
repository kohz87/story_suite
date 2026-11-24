# Changelog

What changed in each release, in short. The full record of every change is in [the detailed changelog](docs/history/CHANGELOG-detail.md); the three old extensions' history is in [docs/history/](docs/history/).

## Unreleased

- Text RPG: a gear point that was LUK now raises WIS, and the Bag and Party show your Text RPG stat names (WIS, or your own) on gear.
- Text RPG: every skill use teaches something, and a good ambush no longer costs practice.
- Text RPG foes now come in kinds (vermin to legend): the game rates them against your level, so 24 rats no longer pay a level, and a battle's XP has a cap.
- Text RPG fights are fairer and plainer: rolls are d20 plus skill rank, difficulty comes from the foe, foes are set up first and XP counts them down, the narrator is told who should win, and fights teach.
- Text RPG: rolls, practice and XP work again in chats with a story clock (the training update made every roll be refused).
- Text RPG: the narrator pays XP as foes fall (not only at the end of a fight), and a skill both used and rolled in one reply costs its stamina or mana once.
- Text RPG: XP counts each foe overcome (6 rats at 5 each = 30); skill practice is +1 for a use or a training session, +3 for a failed roll, +5 for a success, +10 for a hard success, with ranks at 40, 100, 180, 280, 420 and 600; training for 30 story days gives up to +30.
- Text RPG shows the rolls of a reply in one card, a row each (the roll, why it was raised, what it cost, practice); every skill use teaches.
- In a chat that switched from the RPG to Text RPG, the RPG's own blocks (character, skills, foes, rules) stay quiet, so the narrator is taught one system; switching back finds their values.
- Text RPG's Mana and Stamina use the RPG's formulas and grow with level; worn gear counts in them, and the Party sheet shows the gear bonus the rolls use.
- Text RPG's New character now works like the RPG's: stats start at 5 with 10 points to place, your persona's name, a starting level, and Start from a saved character (RPG or Text RPG files); Export works for Text RPG characters.
- Text RPG levels take 100 XP each like the RPG's, skills go up to 8 (one more every 10 levels), and its Rules page has Level cap and XP rate.
- Switching the RPG on from the Text RPG page now shows Text RPG off on the Start page.
- Text RPG's New character shows your persona's portrait, like the RPG's wizard; plug-in modules can ask Story Suite for it.
- Text RPG's New character is the same wizard as the RPG's, its Rules page has an RPG switch to go back, and gear you equip counts for your character.
- A guide for writing your own module (docs/dev/writing-a-module.md), with a short version for AI coding assistants in the AI-README.
- Text RPG is playable: the Party tab shows Create your character, the form opens in a sheet, gear and its stat bonuses work and gear wears down on bad rolls, and you can edit the narrator's rules on its Rules page.
- Plug-in cards and pages show their own icon; Fishing registers again.
- Text RPG: deleting a reply that gave a level now takes back the stat points and skills it paid for, and they return when you earn the level again; skill slots keep coming every third level up to level 99.
- Switching Text RPG on switches the RPG off (and the other way round), and Text RPG has its own page under Rules (Tone, Survival, Stat names).
- New example module, Text RPG: an RPG told entirely in the story, with no fight board. Your stats and skills are described to the narrator in words, dice decide the turning points, and wounds, mana and stamina wear down. Install it next to Story Suite, then turn the RPG off and Text RPG on.
- A plug-in character sheet can now show on the Party tab when the RPG is off, and only one set of dice rules is taught to the narrator.
- A typed attack opens the fight board again when the fight check words the foes a little differently ("hound-sized" for your "hound size rats").
- A new place the story tells the way to ("Fernhollow, a day north") is saved on the map there, so its direction stays right from then on; the narrator writes it with way: or at: on its route or landmark line.
- Each reply now tells the narrator where places lie as the crow flies: the places your message and the last reply name, and the nearest city each way ("Auvoth about 50 km west").
- The narrator is told which way each road out of where you are leads ("Auvoth (west) by frontier road"), so it stops sending you east to a town that lies west.
- Armour soak now takes off only the whole points it adds up to: 6% soak no longer turns a 3-damage hit into 2 (it starts taking a point off at 17 damage). Fights already open keep the old rule.
- Someone new you meet on the way (a shopkeeper at another spot) is no longer shown as present where the reply ends, and keeps the mood the story gave them.
- Each reply now reminds the narrator who is in the scene (and who your message calls in, or anyone who arrives), so people in the background get their memories, what they're doing now and new goals on the dossier at once instead of waiting for a Refresh.
- A mood the story gives someone is shown on their dossier right away, even a word the mood list doesn't rate ("shaken"), instead of waiting for a Refresh.
- A person's dossier keeps up with the story: a goal, mood or memory a reply gives them shows as their latest change at once, and the narrator can give anyone a memory of a reply even when no feeling moved.
- Two different events that share a phrase ("without raising a panic") are now two memories; one no longer replaces the other.
- Someone new the story added with a + npc line now shows their latest change on the dossier too, from their next goal, mood or look.
- A reply gives each person at most one new memory through memory: (a second is noted as a problem), and someone new added with + npc can arrive with a memory: of their own.
- When a reply tells one event twice about someone (as the reason for a feeling and again as a memory), it is kept as one memory, not two; two different events of one reply that only share a few words or a name stay two.
- A dossier's latest change also moves when the story gives someone a gender, a Level, an ability, a keepsake, another name or something they now know.
- Deleting the reply where someone's feelings first moved no longer wipes out what later replies gave them: their goals, meters and memories stay.
- The world's own people are told to the narrator anywhere in their village, town or city (any spot in it, never past its edge), so they arrive as their pack describes them, race and look included.

## 0.1.6 — 21 Nov 2026

- Gear the story finds gives its rarity's full stat points (uncommon 2, rare 3, epic 4), even when the narrator writes only +1.
- Long chats stay quicker: from 75 replies, replies older than the last 50 are tidied, so the file shrinks by a third or more and deleting an old reply takes seconds, not up to half a minute; their changes can't be undone (Settings › Tools › Story history).
- New setting Companions who are away wait (off): a companion the story has away sits out fights and shows as away on the Party sheet, with where they went; a second setting can pay them a share of a won fight's XP.
- New switch in Settings › Features, Encounters (off by default, a first try): before a reply the world may put one passer-by in your path at the place you are, an everyday local or someone you have met.
- World events (when switched on): a new setting lets the Director judge each world event the story writes; it is heard as rumour until judged, then kept, reshaped, or dropped as a false rumour.
- World events: the same setting lets the Director hold back an event the world is about to roll for a day, with a reason; an optional daily Director pass (off) may also make one likelier or less likely.
- World events: an arc plan may now propose up to two new world events, each at a real place and citing what in the world causes it; one with no real cause is left out.
- World events: deleting a reply from the middle of a chat no longer briefly brings back a condition whose event had already ended.
- World events: the Director's verdicts on world events no longer overwrite newer story words, survive a swipe or Continue, stop when the setting is off, and a refused event stays refused unless the story starts it again.
- Hordes on the fight board: foes that keep coming refill the slots of the beaten, wave after wave, until the reserve is gone, their leader falls, you hold for the set exchanges, or you flee; each wave pays its own XP.
- New switch, off by default: the Journal names who was there for each line of a day, and a person's Past lists the story lines they were present for.
- Settings › Help: the questions and answers (fights, XP, gear, moods, portraits, the lorebook) in the app with a search box and buttons to the Settings pages they name.

## 0.1.5 — 21 Nov 2026

- A person's mood headline follows the narrator's mood line at once, not only after a Refresh (the bars and history already did).
- NPC State keeps moods current: the narrator writes a person's new mood when it changes in a reply, and the quiet catch-up refresh re-checks each person's mood, so a mood no longer stays as it was first written.
- A person's page: the With card and page show who you are to them again (NPC State's relationship summary), above the last change.
- Gear now wears in board fights: a decisive hit taken wears your body armour (else shield), a decisive miss wears your weapon, one step, and the narrator is told (new fights).
- The ✦ button on a reply is now one of SillyTavern's own small message buttons (same size and fade), so it no longer pushes the row taller, and its click always opens the sheet.
- Changing or replacing your persona's picture in SillyTavern now updates the suite (Party, reply card, drawer) at once.
- Journal › Closed: each quest's Remove sits on the right under its outcome, no longer stretched across the row over the summary.
- Party › Skills: each skill shows its practice toward the next rank ("34/100", or Max), and its sheet says how far to the next rank and any level it still needs.
- A Speed stance now adds its full skill mastery to dodging (+2 at Apprentice instead of +1), so a dodge build can dodge; extra actions are unchanged (new fights).
- Stat bonuses from worn gear now count in fight rolls (new fights) and in story checks, so AGI 11 + 5 from boots rolls as 16; the fight log shows the AGI used.
- A fight with more foes than an even fight allows no longer drops the extras: past 4 standard foes (or 3 elites) they come in a tier lower, so "a sounder of 7 boars" is 4 boars and 3 lesser ones.
- Someone who left a place no longer shows as present when the story returns there without them; only who the story puts in the scene is Here.
- The ✦ "This reply" sheet (Re-read this reply, Open Suite) opens in the message, above the reply card, instead of squeezed into SillyTavern's button row.
- Fight XP for mobs and minions follows their toughness again: a mob pays a quarter of a standard foe, a minion half (new fights; fights already won keep what they paid).
- A won fight now pays 15 XP for each foe (scaled by level gap and tier, up to 100), so two level 2 boars pay a level 1 hero 33; fights already started pay as before.
- The world's people who are nearby but not met yet reach the narrator with their manner and voice, so someone like Sister Temiwa speaks as herself from her first line.
- A pack person the story brings in (Sister Temiwa and the like) now gets the pack's portrait even before the world counts the meeting.
- A person's Past page: memories keep their date and reply but no longer link to the calendar.
- Ersveil: all 31 people have new, sharper portraits (675×1200, each in a pose of their own); import the pack again to get them.
- A person's page on a desktop window: an opened part (Mood, Ties, Profile …) now takes the cards' place, as on a tablet, with ‹ Dossier to go back.
- Story › Trackers: standing and fame show their factions and regions ("guild 2 · church -1", or "all 0") instead of [object Object].
- A person's Profile (Profile › or a tap on the portrait): the portrait fills the portrait column on a tablet or desktop window, and sits full size at the top of the page on a phone; the portrait column is wider.
- A person's Ties page: a tie described in a sentence shows it as a normal line instead of a big capitals tag.
- A world pack's keyword lore now goes in with the newest message, so older messages stay the same from turn to turn and the model's prompt cache can reuse them; Settings › Packs offers Update for a lorebook made before.
- Clicking a choice adds it to the message box on its own line instead of replacing what is there, so you can send several choices or your own words with one.
- A big crowd of mobs or minions ("a dozen rats") comes in as groups of six, each its own foe slot, instead of being cut to six.
- Fights pay more XP for mobs and minions (their own XP factor: mob 0.5, minion 0.75), so six rats at your level pay 12 XP instead of 6.
- A crowd that was split into several groups pays the same XP as one group of its full size, so twelve rats in two slots pay as twelve rats.
- A person's page: a tap on the portrait fills the portrait column with it (the top part on a phone); ✕ or a tap closes it, and Profile › still opens the profile.
- A world person whose page was made before the story met them (the narrator named them first) now gets the pack's picture and its pack link once they are met, instead of staying without a portrait.

## 0.1.4 — 20 Nov 2026

Every reply gets its own card, the suite floats over the chat in one layout at every width, the Now tab is gone, and a person's page is redone in the shape the old NPC State dossier had. World packs make their own lorebook, Ersveil gets portraits for its whole cast, and the fight board starts from a typed attack again.

### Added

- Every story reply has a card under it: that reply's time, place and weather, your HP, MP and SP then (with what it changed), and your condition.
- The card's tabs, Changes, Chatter, Here and Choices, show what the reply changed, the inner thoughts, who was there and its choices; tap a choice to put it in the message box.
- The newest reply's card has an Open Suite button in its corner and, when something waits, a line of things to do: a fight, loot, points, overdue items, someone asking to join.
- Settings › Chat extras › Tabs sets the order of a reply card's tabs and hides the ones you do not want, for every chat.
- A person's page shows the reply of their last change, the story date and reply of each memory, and why their mood changed; Day › opens the Journal on that day.
- A person's page has a Dossier / Map switch (Map is the relationship map with them picked) and a library strip listing everyone, or only the people you follow.
- Settings › Packs: Create the lorebook makes a SillyTavern lorebook of a world pack's lore, used with the character (chat lore is left alone); Update remakes it.
- Pack Studio: Export lorebook saves a world pack's lore as a SillyTavern lorebook file.
- Ersveil 4.1.0: every cast member has a portrait (19 new); update the pack in Settings › Packs to get them.
- Three stances: Defence, Speed (dodge and act sooner) and Focus (INT or WIS, uses Mana: your INT and WIS skills hit and heal harder); old names still work.
- Bag: + Add works with an empty bag; equipment gets Slot, Rarity and a Stats picker, Carries for bags, and transport (horse, mule, cart) can be added, edited and removed.
- Party: Mount and Bag slots choose which mount a member rides or which bag they carry; the equipment circle shows the member's portrait.
- World › Map: districts say where they lie ("About 3 km north-east of Auvoth's centre"); a city's wards fold into one marker until you zoom in.
- New character: a hint says which bar a skill uses, and once one skill is a stance the others cannot be one.

### Changed

- On a desktop window the suite is a centred floating window (up to 1280 by 940) in the same layout as on a tablet; phones and narrow windows stay full screen.
- The Now tab is gone: the suite opens on Party, what needs you is a red count on the Journal tab with its list at the top of the Journal, and pack offers sit in Settings › Packs.
- A person's page is redone: portrait and feelings on the left, the cards beside them, and on a desktop window the card you open sits next to them (its own page on a tablet or phone).
- A person's page is always the flat surface (no sky, glow or shade).
- The row under the last reply, the Here drawer, the Inner chatter fold and the Choices chip are gone: all of it is on the reply cards.
- HP now comes from STR and VIT, SP from AGI and DEX, MP from INT and WIS.
- Fight board: after an exchange you go straight back to choosing, and with one foe left an attack goes to it without a tap.
- Add to party shows on a person's page only when the story offered them as a companion.
- Story › Trackers and Settings › Packs no longer list the RPG's own Character, Skills and Foes blocks.
- Every sheet opens as a centred window over a dimmed page on a wide screen; Glass strength reaches every glass surface.
- Rings, amulets and accessories default to CHA; the Field medic set's Mending uses WIS; a Focus skill on another stat is kept on INT or WIS.
- Messages and notes say "NPC State", not "NPC State Delta".

### Fixed

- NPC State starts when the browser has an ad or privacy blocker (three of its file names were blocked, so no dossiers were made).
- Someone the story brings into the scene by name gets an NPC State record at once (a world pack's people from the pack; anyone new from the story).
- A typed attack starts the fight board again, also when the connection returns JSON, when it names a crowd ("a dozen rats", cut to six) or goes on past the fight.
- A reply that came without its change block gets its inner chatter and choices back when the suite repairs it.
- The combat log in a reply folds again, and its Health, Stamina and Mana bars show.
- The fight board's stance switch slides all the way across.
- Party › a skill's sheet no longer prints "null"; Bag › Wear on… keeps the sheet open with the reason and an Edit item button when a piece has no slot.
- Layout fixes: the reply card's bars and icons, the library strip's ring, a person's Right now spacing, Profile labels, the wizard's skill cards and the card's place line.

## 0.1.3 — 19 Nov 2026

Packs move to format 4: a world pack holds the world (lore, people, places, routes, events) and a game pack holds the rules, calendar, money and climate. Ersveil comes as such a pair. The new Pack Studio writes and checks packs. The old view is gone, so there is one view, with a desktop layout and a much fuller Settings, and long test plays led to many fixes.

### Added

- Pack format 4: a world pack plus a game pack (rules, calendar, money, climate). Ersveil comes as a pair; older packs are refused, with a hint to convert them.
- Settings › Packs: pick a world and a game, see "This world suggests…" and any problems in the pair. A character card can carry both; a world zip can include its game.
- Pack Studio (Settings › Packs › Open Studio): forms for every part of a pack, undo and redo, saved drafts, Go to for each problem, and Export once the pack has no errors.
- Pack Studio Dry run: play a pack forward for some days and read its Timeline, Holds, Curves and Cast.
- Weather follows the climate where you stand (the place, else its region; nine built-in climates). A game pack can bring its own weather or leave it to the narrator.
- Desktop layout from 1100 px: your character and "Here now" on the left, the tabs on the right. Wide windows open the view in place with a soft fade.
- People from a world pack arrive with their whole profile. The dossier shows Level, goal, abilities and keepsakes, and the narrator can give them.
- A companion who joins gets a party sheet built from their NPC State record (level, best stat, skills, keepsake gear).
- Story › Director: plan the next arc with a note, accept or discard a waiting plan, and see overdue clocks.
- Journal › Quests: Edit, Give up and Delete, and they stay the same after swipes, deletes, rewinds and reloads.
- Settings › People: your own meters, presets, stages and a stage ladder; "People in this chat" with Open and Re-read for each person.
- Settings › Tools: NPC State data (back up, restore, diagnostics), Export this chat's people, readable prompts with Reset to default, and Export settings as a game pack.
- Settings › Look › Panel background (off by default: a plain colour instead of the sky picture). Settings › RPG and fights: Difficulty explains each choice; Custom sets starting stats.
- Party: Export saves a character file. Bag: + Add makes a new item. Fight board: Auto plays up to your set number of exchanges; Discard fight asks first.
- The ✦ "this reply" sheet has Re-read this reply. Now › Needs you keeps a join request until you answer.
- World events: hidden lore opens when its condition holds and then reaches the narrator. The world's own people at your place reach the narrator by name.

### Changed

- Settings is a proper window: Tab stays inside, Escape closes an open editor first, cards fold (remembered on this device) and grey out while their module is off.
- Dossiers and sheets work the same way, and the browser or phone Back button closes the top window, then the suite.
- Start page: real module cards and Lean, Standard and Full presets. Settings say why a value was refused. Mounts is now Transport.
- Each chat keeps the calendar, money and seasons of the game it started with, so a later pack does not re-date it. The Calendar choice "pack" is now "game".
- The party holds 4 active members; the party pill and the Party tab show the limit and offer no Invite at four.
- A long time skip with World events on runs each day once: a one-year skip on Ersveil takes about half as long.
- NPC State matches names more strictly: a first name, surname, title or role finds one person, and death is final.
- Trips: a made-up place stands for the pack place it names, so the pack's route is used. A story route between pack places the pack does not join is refused.
- With the Story Director off, Story › Director shows one card: "Story Director is off".

### Fixed

- Cards under replies are back: Add to party, Edit first, No, and "The story ends here" when your character dies. Loot has its chip and a Bag "To pick up" card again.
- Fights: a fight the narrator opens and you do not play is not told blow by blow; it lapses after two replies. A hero's Level and NPC State Level stay in step.
- Speed: building the prompt, an edited Re-read and a middle delete no longer freeze. NPC State catches up three people at a time, with one notice.
- The narrator uses pack people's canon names and profiles, and is told a newcomer's name to use once someone in the story says it.
- Party and Bag: Wear on and Give to act on the member you pick, Equip and Unequip work, and worn gear shows per member.
- People and dossiers: search by alias; your own feelings have bars; Delete, Edit and Mark alive work; a goal shows as Wants; quoted speech stays whole.
- Look settings (panel style, glass, font, text size) work and survive a reload. Uploaded portraits stay after a reload.
- World tab: north is at the top of the map, made-up places show under Places, News, Find and the region picker work, and Edit says why a change was refused.
- Time and Journal: deleting a time skip moves later times back, Problems rows keep their reply number, and late quests say "overdue".
- Many layout fixes on phones and desktops: the character window's Create button, the Export sheet, light-theme contrast, map labels, the tab strip, the Suite button over the swipe counter.
- Keyboard and focus: opening the suite takes focus, Settings pages open at the top, and focus returns to the message box after you make your character.
- Pack Studio: many fixes to lists, delete cards, Go to, lore conditions, renames, the phone layout and the light theme. Old-format packs open read only.

### Removed

- The old view: the bar above the message box, the story panel, game view, HUD, old settings window, old dossier window and "Use the old view".
- Settings rows with nothing behind them, the format 3 sample world, and data left by the old Story Block.

### For developers

- A click-through test of every Settings control runs in CI at three widths, dark and light; the release walkthrough lists it.
- AI-README.md describes the suite for vibe coders. A pack format 4 checker and a format 3 converter were added; the release build includes the Studio.
- Old view code, the old planner and the old NPC State journal were removed, and many files moved into folders.

## 0.1.2 — 18 Nov 2026

Short story arcs come to the world: with World events on, the Director can write a small arc of two to four happenings that play out on their own days. Making your character works in the new view, six empty fields now show data, and editing a reply is much faster.

### Added

- Short arcs (World events on): an opening, up to two more steps and an ending, kept with the chat and the same after swipes, Re-read, deletes and reloads.
- The New character window (Who, Stats, Skills, Review) and the "make your character first" hold now appear in the new view.
- Six fields now show data: Bag › Purse › This turn, Journal day lines, Journal › Planned trips, a kept quest Focus, Story › Agendas names, Story › News on the road.

### Changed

- A world event that waits for an arc to end happens a day after the ending at the earliest.
- With World events on, a failed Director call for small happenings is tried once more.

### Fixed

- Editing a reply's story text is much faster (about 0.93 s down to 0.13 s in a chat of 201 messages).
- Character windows keep keyboard focus, keep Tab inside, and show normal skill sentences.

### Removed

- An unused writing box on the Fight tab.

### For developers

- Arc plans are checked and stored whole, with tests for replay after a swipe, a delete and a rewind.

## 0.1.1 — 18 Nov 2026

The world can move on its own behind the World events switch (off by default): events, conditions, a daily world step and news that travels along the routes. The Director fills small happenings and weighs arc plans against the world, and NPC State keeps a world pack's secrets until they are earned. This release also brings the sample world Ersveil, a first read-only Pack Studio and faster replies.

### Added

- World events (Settings › World and time, off by default): events and conditions from a world pack, a daily world step, and Tempo for how fast the world moves.
- News travels by courier along the routes and arrives after the travel time; beyond its reach it comes as a rumour naming only the region.
- Each reply's prompt carries a short "World now" note: the conditions where the scene is and the newest news that has reached it.
- The World tab shows a Conditions here card and how the news came. Settings shows World events, Tempo and Director calls this game year.
- The Director fills small happenings from the pack's own menu and weighs arc plans against the world (events under way, protected people, hidden lore).
- NPC State keeps a world pack person's secrets in their dossier until their condition is met.
- Sample world pack Ersveil: 31 people (12 companions with portraits), lore, realms, powers, conditions and 103 world events.
- The Follow star also puts a person on the narrator's key list, and People › Elsewhere shows what followed people are doing.
- Settings › Tools has a Save points card. A first Pack Studio opens a pack read only to browse its parts and problems.
- Settings › Models › Calls: keep the last two replies' change blocks in the prompt (on by default).

### Changed

- A pack may carry world sections and install them; before, it failed to install.
- The World tab shows a region's name instead of its id.
- A first meeting no longer gives the narrator the stranger's name before the story does; the meeting stays in the Journal's Met.
- Faster and smoother: less work per reply in the new view, smooth chat scrolling, and the World map no longer redraws every frame.

### Fixed

- A repaired travel stretch no longer overshoots a day unless the reply says so; a repaired day jump keeps the time of day; a doubled reply draft is cut.
- NPC State no longer waits 5 seconds after an edit or delete.
- After an edit and a Re-read, a trip's first stop is the same place the story told.

### For developers

- The release tool also writes the pack checker's version. NPC State is the last built-in module, and a failure switches it off with a Problem instead of stopping the suite.
- The World events engine (conditions, daily step, news reach, judge, secrets, lore digest) has tests; with the switch off nothing changes.

## 0.1.0 — 18 Nov 2026

Story Block, Story Director and NPC State Delta become one extension, Story Suite, with a new view: tabs Now, Story, People, Party, Bag, World and Fight, and a Settings overlay. Every fight follows one set of rules, Combat Rules v1, on the fight board. NPC State records changes to people as short lines in the reply, and a safety net repairs replies that forget their change block. Nothing is carried over from the old three extensions.

### Added

- One extension, one drawer, one Models page listing every model call, and Settings › Diagnostics for any part that fails to start while the rest keeps running.
- The new view: tabs Now, Story, People, Party, Bag, World and Fight, one Settings overlay, dark and light, and a list of changes under every reply.
- Settings pages for Start, Models, Director, RPG, World and time, Money, Chat extras, People, Packs and trackers, Add-ons and Tools.
- Story › Trackers: pin a tracker to Now, edit its values by hand, remove one, or add one of three starters.
- Now: the place and time before the first reply, a "Foes are standing" card with the offer to fight, a trip card, and an Install offer when a character card ships a pack.
- The story clock runs without a pack: a time in a reply ("next morning", "+2h", a clock time) sets it.
- Combat Rules v1: seven stats (STR, VIT, AGI, DEX, INT, WIS, CHA), HP/MP/SP from stats and level, typed skills, foe tiers from mob to apex, and a New character window.
- Companions: Add to party on a person's page, and a join card under the reply (Add to party, or Edit first).
- NPC State lines in replies: new people, changes, relationships, and a level when the story states one.
- Rolling Refresh: each person's slower details (personality, speech, background) are caught up every few replies, a few people at a time; on by default.
- The safety net: when a reply has no change block, it writes the changes the reply plainly shows, marks them "Assist", and offers Discard repair.
- Activities (a fight, a mini-game) get their own tab while open.
- Pack format 3: packs name the Story Suite version they need and can list foes by tier. The sample world Ersveil uses Combat Rules v1.

### Changed

- The safety net runs on the Background connection (it used Quick helpers before); check both if you set them differently.
- Story checks are success or fail; a natural 20 is decisive when it meets the DC.
- NPC State no longer asks the narrator for a hidden block, so replies are shorter. The narrator's people list names active people only.
- Luck is gone: WIS covers luck, will and senses, and a file that says LUK is read as WIS.
- A pack can no longer tune combat numbers; one that sets them still loads, with a warning.
- Every reply is asked to end with a change block (empty when nothing changed), so a missing block means something was forgotten.

### Fixed

- Settings writes that did nothing (Look rows, Tools budgets and others) and empty Settings pages now work.
- Fights: a fight started from your attack runs in the new view; the end card shows each member's XP and practice; a stance switched off stays off.
- A person's page left open no longer covers the suite; a person's Refresh in the dossier now runs.
- The trip card no longer shows a planned trip as already on the road.
- Swiping a reply and back no longer leaves stale changes, and the repair ignores a change tag that is only mentioned in the text.

### Removed

- The older combat rules, the roll planner, narrated fights, and the Rolls and Fight board switches.
- Save points, the layout editor (Customize) and the strip across the top of the new view.
- The separate NPC State Delta drawer, any import from the three old extensions (delete them first), and the Riverside starter pack.

### Known limits

- Whether the narrator writes the change block depends on the model; the repair is a guess from the reply, so check the changes when it matters.
- Discard repair and the "No changes recorded" badge work on the latest reply only.

### For developers

- One repository and one version number: the release script writes it everywhere and the release check fails if a place disagrees. A release is a version bump merged to main.
- One release build; the old view's leftovers and the old handshake between the three extensions were moved or removed.
