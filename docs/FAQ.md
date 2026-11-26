# Questions and answers

## The story said I found an item, but it wasn't added. How do I get it?

Tell the narrator in your next message, out of character, for example: "(OOC: the ash-grey longsword from the last reply wasn't added)". The narrator then adds it in its reply with a change line such as `+ item Ash-grey Longsword | kind: equipment | slot: weapon | rarity: rare | STR: +2`. The gear rules still cap the bonus for the item's rarity. Ask only for what the story already gave you; the narrator decides.

## Where did my skill practice go?

Practice comes only from a skill's rolled use, in a fight or in a check. It shows on the reply card as "Astra's Shadow Cut +6 practice (rolled)". The narrator no longer writes practice lines (with Rolls turned off in [Settings → RPG and fights](settings:rpg) it still can). Fight XP comes from code when a fight is won and shows as "+N XP" (see "How much XP does a fight pay?").

## Can I get an ambush or a first strike?

Yes. When you use a skill before a fight to get the drop on the foes (hide, sneak, lure, slip behind them), it becomes a check with that skill, in the same reply as your attack or in the reply just before it. If it succeeds, your first attack gets +2 that round (with the Standard rules the party also strikes first). If it only succeeds at a cost, or fails, there is no surprise. A drop you win in one reply is used once, on the very next reply that attacks, and is gone after that. The battle log says which in one line.

## My character has no Mana left. What happens to a planned spell?

With Mana empty, name a Stamina skill or rest; a planned skill falls back to its named backup skill, else a plain attack.

## How many skills can a character have?

Five slots to start, then one more at Lv 20, one at Lv 40 and one at Lv 60 (up to eight). A level drop never takes a skill away. The story never overwrites a filled slot. You can change a skill yourself with its pencil (its name and what it does); its rank and practice only move through play.

## Can a card bring its own world?

Yes, since 2.21.0. When you open a chat with a card that carries a pack, its portraits or recommended settings, a notice at the top of the Story panel offers **Install** or **Not now**. Nothing is installed or changed without your click, and recommended settings are ticked by default and only listed when they differ from yours. Card authors: see [Build your first card](v2/BUILD-A-CARD.md), "Ship your whole world inside the card".

## A pack was updated: how do I move my running chat to its new layout?

A running chat keeps the old modules and keeps working. To take the new version of a module, open [Settings → Packs and trackers](settings:packs), find Data modules, choose **Migrate** on the module, read the preview and confirm. Do this for each module the pack changed (Ersveil 2.7.0 changes four: Standing, Fame, Adventurer Guild membership and Court favour). Only the drawing changes, your values stay, and the choice is saved with the latest reply. A new chat needs nothing.

## How do I start my own company, fief or trading house?

With the Ersveil rules, turn on **Your Holding** first: it is off until you do. Open [Settings → Packs and trackers](settings:packs), find Data modules in this chat and switch on Your Holding; it then stays on for that chat. Then say it in the story, for example "we raise a palisade on the hill and call it Ravenhold". A paid month gives +2 loyalty (up to 100) and an unpaid one costs 15. If the story writes a second month line in the same story month, the upkeep is charged again.

Your holding also has officer posts (steward, marshal, spymaster, healer or chaplain, quartermaster and envoy), each a small bonus. Once it has a seat, have someone stay there and say it in the story, for example "Mara stays at Ravenhold as steward". They must not be travelling with you. A holder who travels with you again, or dies, leaves the post.

## Why is my added item Common?

With Gear in fights on (in [Settings → RPG and fights](settings:rpg)), "+ Add item" opens the grouped form. Rarity and Bonus can be set only in the **starting kit**: while the chat holds the opening greeting and no message from you yet (a greeting swipe keeps it open; deleting your own messages while a reply stays, a narrator or member speaking on its own, or a chat with no greeting keep it closed). After the kit, an added piece is always Common (+1), and Edit shows Rarity and Bonus read-only on pieces you added. Weight (what one unit weighs in load) and, on armour, Soak (up to the slot's cap) are not the kit's: Edit sets them on any piece that is not a cast member's, any time. A name that a story or pack piece already has never copies its rarity or bonus: you get your own Common piece ("Your Ash-grey Longsword"); adding to a piece you made yourself still stacks. A saved character's gear is kept as written only while the kit is open; afterwards it comes in Common and the Problems list says so.

## How does a fight work?

When the story turns to blows, or you type an attack, the fight board opens over the chat. You choose for your own character, and for every party member in turn: an attack, a skill, a stance, an item or a retreat. After each exchange you go straight back to choosing, and with only one foe left an attack goes to it without a tap. A crowd ("a dozen rats") comes in as groups of six, each group its own foe. When there are more foes than an even fight allows (past 4 standard or 3 elite foes) the extras come in a tier lower instead of being dropped. The rules and the fight options are in [Settings → RPG and fights](settings:rpg).

## How much XP does a fight pay?

A won fight pays 15 XP for each foe, scaled by the level gap and the foe's tier (up to 100). Mobs pay half a standard foe's share and minions three quarters of it. A crowd split into several groups pays the same as one group of its full size. Fights already won keep what they paid. The "+N XP" shows on the reply card, and the XP rate row in [Settings → RPG and fights](settings:rpg) scales it.

## What do the stances do?

There are three. Defence makes you harder to hurt. Speed adds your full skill mastery to dodging and lets you act sooner. Focus uses Mana and makes your INT and WIS skills hit and heal harder. Once one of a character's skills is a stance, the others cannot be.

## Does my gear matter in a fight?

Yes. The stat bonuses on what you wear count in fight rolls and in story checks, so AGI 11 with +5 from boots rolls as 16, and the fight log shows the AGI used. Gear also wears: in a board fight a decisive hit taken wears your body armour (or your shield if you have no armour), and a decisive miss wears your weapon, one step each time. The narrator is told, so it can mention a chipped blade.

## Why did a person's mood change, or not change?

NPC State keeps each person's mood current. The narrator writes a new mood whenever it changes in a reply, and the quiet catch-up refresh re-checks every person's mood, so it does not stay as it was first written. The mood headline follows the narrator's mood line at once. A person's page shows the reply where something last changed, why their mood moved, and who you are to them. Settings for how often and for whom it runs are in [Settings → People](settings:people).

## How do I get a person's portrait?

A world pack's people come with the pack's pictures, and they appear as soon as the story brings the person in, even before the world counts the meeting. Ersveil's 31 people have new portraits: import the pack again to get them (in [Settings → Packs and trackers](settings:packs)). Tap a portrait on a person's page to see it large; ✕ or another tap closes it, and Profile › opens the profile. Changing your own persona's picture in SillyTavern updates the suite at once.

## What is the world pack's lorebook, and why Update?

Create the lorebook in [Settings → Packs and trackers](settings:packs) makes a SillyTavern lorebook from a world pack's lore, used with your character; lore already in the chat is left alone. A world pack's keyword lore now goes in with the newest message, so older messages stay the same from turn to turn and the model can reuse its cache. If you made a lorebook before that, press **Update** on it to remake it the new way.

## Where did the Now tab go?

It is gone. The suite opens on Party. What needs you (a fight, loot, points to spend, overdue items, someone asking to join) is a red count on the Journal tab, with the list at the top of the Journal, and on the newest reply's card. Each reply has its own card with its time, place, weather and what it changed; its tabs can be ordered or hidden in [Settings → Chat extras](settings:extras).

## I clicked a choice and my words were still there

That is how it works now: a choice is added to the message box on its own line, so you can send several choices, or your own words with one.
