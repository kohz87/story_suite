# Changelog

What changed in each release, in short. The full record of every change is in [the detailed changelog](docs/history/CHANGELOG-detail.md); the three old extensions' history is in [docs/history/](docs/history/).

## Unreleased

- Fight board: after an exchange you go straight back to choosing (the exchange just done shows as one line above), and with one foe left an attack goes to it without a tap.
- Fight board: the stance switch slides all the way across.
- The combat log in a reply folds again, and its Health, Stamina and Mana bars show.
- A person's page keeps its Mood and Ties cards before NPC State has read them ("Not read yet", "No ties yet"), so it keeps the two-column layout.
- A person's Profile lines up its labels in one column, and the Wants and Hiding rows sit clear of the Scene spoilers switch.
- The Here drawer floats over the bottom of the chat instead of pushing it up.
- Add to party shows on a person's page only when the story offered them as a companion.
- The name on a person's page is smaller, with room below the feelings ring.
- The Here drawer above the message box is as wide as the chat, and inner chatter shows in full on Now (it was cut off).
- With SillyTavern's swipes on all messages, the Suite button under a reply no longer sits on top of the swipe counter.
- NPC State now starts when the browser has an ad or privacy blocker: three of its files had names blockers refuse, so it never started and no dossiers were made.
- Settings › Packs and trackers: the RPG's own Character, Skills and Foes blocks are no longer listed as trackers (one line says they belong to the RPG).
- People: someone the story brings into the scene by name now gets an NPC State record at once (a world pack's people from the pack; anyone new is filled in from the story).
- The card's place line sits level with ‹ Chat and ⚙ (its › no longer wraps under a long name); an item's Stats row lines up with the rows below it.
- A Focus skill the story writes on another stat is kept on INT or WIS (your higher; WIS on a tie) instead of being refused, and the reply says so.
- The Field medic set's Mending uses WIS, so its Calm (Focus) stance strengthens it.
- Bag › an item's **Edit** and **+ Add** have **Carries** (the load it adds), and a bag-like item's sheet has **Carry as bag…** with portraits; a pack's or bound item shows why it can't be changed.
- Bag › Assets › Transport: **+ Add** a horse, mule, cart or other mount (its pace follows the kind), and a mount's sheet has **Edit** and **Remove**.
- World › Map: a district's sheet says where it lies ("About 3 km north-east of Auvoth's centre"), using the map scale read from the pack's roads; the ‹ back button sits clear of the sheet's edge.
- World › Map: a city's wards and the places on top of it show as one marker ("Auvoth · 7") whose sheet lists them; zoom in to fan them out. A selected place gets a thin ring, and the map moves it above the sheet.
- Three stances now: Defence, Speed (dodge and act sooner: Evasion and Movement in one, without Movement's extra action) and Focus (INT or WIS, uses Mana: your INT and WIS skills hit and heal harder).
- Old stance names still work: Evasion and Movement read as Speed, Support as Focus. The fight board's stance switch and the Party sheet say what each stance adds.
- Party › a skill's sheet no longer prints "null" under its rank; Bag › Wear on… shows each member's portrait.
- Party › Mount and Bag slots: tap them to choose which party mount a member rides or which bag they carry (None frees it); a mount left behind, already full, or a bound bag says why.
- Bag › Wear on…: when a piece cannot be worn (no slot set), the sheet stays open with the reason and an **Edit item** button that opens its Slot.
- Party › Skills: tapping a skill now shows what it does under its kind; a skill with no cost reads "Story only", and a missing value is left out instead of showing "null".
- New character › Skills: the "What it does" box shows four lines, the × lines up with the name, and Type / Starts at no longer cut their words on desktop.
- New character › Skills: a hint line says which bar a skill uses (INT or WIS: Mana; any other stat: Stamina; a heal: Mana; a stance: 1 each exchange).
- New character › Skills: once one skill is a stance (Defence, Speed or Focus), the other skills' Type lists show the stance types switched off and name the skill that holds it.
- Settings › Packs: **Create the lorebook** from a world pack makes a SillyTavern lorebook of its lore, so the narrator reads it too; **Update the lorebook** remakes it when the pack changes.
- **Use with this character** (on by default) attaches it to the character, beside any lorebook the card has; chat lore is left alone. Hidden lore stays out of the book.
- Pack Studio: **Export lorebook** saves a world pack's lore as a SillyTavern lorebook file.
- Tools › What's sent shows the NPC State lines your reply really carries; old leftovers of the earlier NPC State look and its one-time chat conversion are gone.
- Messages and notes say "NPC State", not the old "NPC State Delta"; People, dossiers, Edit and settings look and work as before.
- Nothing changes in play: the code behind NPC State, saving and fights was tidied, and opening a chat no longer looks for fights left open by builds from before the fight board.
- With Gear in fights on, the narrator is told to name the rarity and stats of gear the story makes special (enchanted, masterwork, blessed), and they land on the item.
- On a wide screen every sheet (Bag, Party, quests, World, Scene, trackers, Inspector) opens as a centred window over a dimmed page, with its title and buttons always in view.
- Settings › Look: **Glass strength** now reaches every glass surface (blur, tab strip, chips, sheets and their dimmed layer), not only the panel colour. The default looks as before.
- With Panel background Off, Glass strength now also lifts the cards off the plain colour: higher makes them lighter (in dark) with a firmer edge and shadow. The default looks as before.
- HP now comes from STR and VIT, SP from AGI and DEX, MP from INT and WIS.
- Desktop: a dossier opens beside your character and Here now (up to 1,040 px wide), and NPC State's Edit is a 920 px sheet in two columns with Save and Cancel always in view.
- World › Map is readable on big worlds: names no longer pile up (the rest show as you zoom in or hover), it opens on where you are, and Fit leaves far-off places out with a count at the edge.
- Bag › + Add (now there with an empty bag too): equipment gets Slot, Rarity (at the start of a chat) and a Stats picker; an item's sheet shows its stats with **Change** to move its points. Rings, amulets and accessories now default to CHA.
- Party: the circle in the middle of the equipment shows the member's portrait (yours, or the companion's from NPC State), the initial only when there is none.
- New character on a wide screen: one 920 px window with your character card on the left, the step on the right and Back / Next in their own row; on a phone, Stats' Reset now sits above the stats, never under Back / Next.

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
