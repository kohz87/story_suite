# Ersveil world pack 3.0.0 (world-pack spec v0.14.11, 18 Nov 2026)

`pack.json` is the whole pack. It passes the engine's install check (`packs/validate.js` on origin/world/engine 426b2be, Story Suite 0.1.0) with **0 errors and 0 warnings**. Nothing is left for the author: see "Still for the author" and "Final pass (lead, 18 Nov)" at the end.

## What is in the zip

| File | What it is |
|---|---|
| `pack.json` | The pack: everything under `content.*` |
| `README.md` | This file |
| `portraits/` | The 12 companion portraits (the cast's `portrait` fields name these files) |

The writing docs (`ersveil-world-events.md`, `ersveil-thread-plan.md`, `ersveil-cast.md`, `ersveil-foundations.md`, `ersveil-lore-pass.md`, `ersveil-portrait-briefs.md`) and the first build's `validation.txt` stay in the rework kit folder; they are not in this zip. They describe the pack as first written, before the fixes below.

## What changed from 2.9.6

- **New parts** (spec v0.14.9): `lore` (218 entries, 5 hidden), `placeKinds`, `routeKinds`, `realms` (22, with 5 wild regions), `powers` (15), `scores` (4), `conditions` (31, 13 `open`), `markets` (the six price categories), `worldEvents` (100 as written; 103 after the fixes and tuning below), `templates` (10, 6 of them open).
- **Cast:** 31 people (12 companions, 19 figures) in the spec shape, with gated secrets, `learned:` links and `writes_fact`.
- **Removed:** the 135 legacy `content.events` (owner decision, 17 Nov), the old `content.items`, and `ripples.powers` (the claimants are in `powers` now).
- **Calendar:** Gregorian months; the story starts on **1 October CY 611, 07:00**. Weather seasons are named by month, and `winter` is December to February, which the Turning's season anchor needs. Currency: copper, silver, gold (bronze removed).
- **Places** carry an `id`, and `region` now holds the **region id** (see question 1). Six regions were renamed so that no name contains `: ` (foundations §1). Barak Freeport and Saltledger Quay are cities.
- **Map fix:** Thornwall Redoubt, the Wardens of the Last Wall's fortress, sat beside Cedran Keep in the heartland (-2, 6), so Wendhild "fleeing north" to it went west, and the Last Wall faced nothing. It now stands on Highmark's northern march at (-8, 45), between the Border Kingdoms and Valegard. Its old local road is replaced by the **Last Wall Road**: a bastion road south to Iron Guard Fortress (580 km) and frontier roads north to Redspire (330 km) and east to Tarnby (320 km).
- **Routes:** the 4 parallel routes carry a `name`; 5 hazardous or deep-sea lanes carry `hours`.

## Questions for the coder

1. **Region names.** Realms list their regions by id, and conditions are set `@<region id>`, so each place's `region` now holds the id (`bluewatch-reach`, `atlantis-region`). The display names ("Bluewatch Reach", "Atlantis") are only in the foundations doc. Should a place carry its region's display name too, or should the pack have a region list with names? The start scene's `region` is an id for the same reason.
2. **The world at the start.** The opening conditions (`wildzone-pushing` and `guild-stretched` on Bluewatch Reach) and the two pre-start facts are written by a certain event on day one, `bw-world-at-start`. Is there a better place for a starting state?
3. **Price categories.** With the items gone, `content.markets` is what declares the six categories (food, fodder, arms, mounts, medicine, drink) that condition prices name. Confirm the engine reads categories from there.
4. **"1 year" as a duration.** Windows and cooldowns use `1 year` and `1 season`; anything else is written in days. Confirm `1 year` is accepted (and whether it is 365 or 360 days before tempo).

## Answers from the coder (18 Nov)

1. **Region names: use a region list.** `content.regions: [{ "id", "name", "aliases"? }]` gives each region its display name (ruling 42).
   - Membership stays in `realms[].regions`. A declared region that no realm lists belongs to the Wilds.
   - Every place's `region`, and the start scene's `region`, must be a declared region id, so places keep the id and do not repeat the name.
   - This copy of the pack now has the list (see Fixes applied).
2. **The world at the start: `start.world`.** `start.world: { "set": [condition strings], "facts": [fact ids] }` is applied when the chat starts, recorded with the first reply (ruling 43).
   - It produces no news, no Journal "happened" line and no event, and uses no cap or density.
   - A day-one certain event still works, but it reads as something that just happened.
   - The opening conditions and the two pre-start facts are now in `start.world`, and `bw-world-at-start` is gone.
3. **Price categories: yes.** The categories are the keys of the `prices` in `content.markets`, plus `"all"` (ruling 44). A condition's price effect that names anything else is refused at validation. Your six (food, fodder, arms, mounts, medicine, drink) are exactly those keys, and every condition uses only them or `all`.
4. **"1 year": accepted, as 360 days.** `1 year` = 360 × tempo days, which is 4 seasons of 90 (ruling 45). The calendar's real year (365 days) does not change it; anchors and fixed dates follow the calendar. So `start + 1 year` lands on 26 September 612, not 1 October.

## Fixes applied (this copy only; the original folder is untouched)

- **`content.regions`:** all 30 regions with their display names, placed just before `realms`.
  - The names are the old region headings, with the six renames of foundations §1 applied.
  - The five Wilds regions are included: `ashen-veil` (Ashen Veil), `deep-northern-apex` (Deep Northern Apex), `southern-wilds` (Southern Wilds), `western-barrens` (Western Barrens), `wildzone-sites` (Wildzone Sites).
- **`start.world`:**
  - `set: ["wildzone-pushing@bluewatch-reach: 1 season", "guild-stretched@bluewatch-reach: 1 season"]`
  - `facts: ["early-flood-611", "depths-surge-611"]`
  - `bw-world-at-start` is removed. Nothing anchored on it, and it did no more than this.
  - `start.world` facts are ids only, so the two texts are now in no file. They are now in the Bluewatch and Auvoth lore entries (see "Final pass").
- **`homeBase`:** shortened to the name of the person's start place for the 11 people over 80 characters. Each of them already has a `start.routine`, so nothing was moved into it. The old texts:
  - `temiwa` → "Bluewatch Village". Was: "Bluewatch Village: the Watchhouse infirmary by day, the salt-and-ash yard by night."
  - `torka` → "Bluewatch Village". Was: "The Wildzone north of Bluewatch, where she camps; she trades only at night, in Bluewatch's salt-and-ash yard, the one place that will not turn an orc away."
  - `harrak` → "Varnhold Watch". Was: "Varnhold Watch, the Long Watch's eastern beacon fort on the Shorn-Auvoth road, held by compact with Shornmarch."
  - `rika` → "Auvoth / Pale Market". Was: "Auvoth's Pale Market, working unlicensed spells for cheap crews; sleeps wherever a crew pays."
  - `ysmeth` → "Shackles City / Chainmarket". Was: "Shackles City: the Grey Ledger's collar forge by day; lent out at night to fit new collars at the Chainmarket."
  - `nysseth` → "Shackles City / Knifeglass Alley". Was: "Shackles City: a knife-grinder's stall in Knifeglass Alley by day; the Broken Chain's runs at night."
  - `sir-lothar` → "Highmark Capital". Was: "Highmark Capital: the hospices and the princess's errands by day; the Emperor's private chamber in Crown Keep by night."
  - `gorm` → "Highmark Capital". Was: "Highmark Capital: the Ardelian embassy by day (badly), every tavern in the Civic Ward by night (expertly)."
  - `nerissa` → "Abysswatch". Was: "Abysswatch: the Gannet's berth in the Fleet Basin; the harbour taverns between runs."
  - `hush` → "Vargate". Was: "Vargate: a dry corner of the lamplighters' shed by day; every ward's streets by night."
  - `barney` → "Thousand Sails". Was: "Thousand Sails: the barges by day; somewhere in Hulkrow, the fever-poor quarter, by night."
- **`front-depths` and `front-abyssal-deep`:** `window.within` "1 day" → "5 days". With tempo scaling that is still at least 2 days at tempo 0.25, so they open within a few days of their anchor at every tempo.
  - Both are certain events anchored on another event's firing (`auv-second-surge`, `tide-named`).
  - On that day they are checked before the anchor event fires, so with a 1-day window they lapsed unfired, and those two fronts never opened.
- **`description`:** now says world-pack spec v0.14.10.

## Fixes applied (lead, 18 Nov night)

Applied to `pack.json` of this copy only (owner: use the lead's recommendations overnight; rulings 47-49). One bullet per change, with the old value.

- B1 `tide-turning` cooldown "1 season per place" -> "1 season"
- B1 `tide-ebbs` cooldown "1 season per place" -> "1 season"
- B5 severity "minor" (was absent = major) on all 18 recurring events: `tide-ebbs`, `tide-turning`, `front-north-pushes`, `front-depths-pushes`, `front-western-barrens-pushes`, `front-thornheart-pushes`, `front-glass-wastes-pushes`, `front-abyssal-deep-pushes`, `front-wildzone-sites-pushes`, `front-deepens`, `front-breaks`, `faith-veil-gathers`, `south-election`, `harvest`, `famine`, `plague`, `winter-passes`, `raiding-season`
- `bw-isbro-burns` window.within "30 days" -> "60 days"
- `auv-sealwardens-recruit` window.within "30 days" -> "60 days"
- `econ-tolls` window.within "1 season" -> "105 days"
- `econ-answers` window.within "1 season" -> "105 days"
- `succ-creditors` window.within "1 season" -> "105 days"
- `succ-lothar-judgement` window.within "60 days" -> "75 days"
- `succ-war` window.within "1 season" -> "105 days"
- B8 `sir-lothar` canDieUnmet False -> true
- B8 `durvald` canDieUnmet False -> true
- B9 `front-north` summary "A new front opens: Somner's tap stirs the deep north." -> "A new front opens: something stirs in the deep north."
- A6 `front-north` removed; its set `wildzone-pushing@deep-northern-apex: 1 season` and fact `front-north-open` moved to start.world; summary was "A new front opens: something stirs in the deep north."; fact text "The north front is open."
- A6 `front-wildzone-sites` removed; its set `wildzone-pushing@wildzone-sites: 1 season` and fact `front-wildzone-sites-open` moved to start.world; summary was "A new front opens: the old dungeons spill over."; fact text "The wildzone sites front is open."
- A3 `open-ambition` menu.cast {pick 1, of "figures", move "@region"} removed: the only non-protected people are ottwald, edda-rorke, laan, ermengild, ragna, captain-nell, ulgar, i.e. exactly the excluded ones, so the explicit id list would be empty
- Where the removed fronts' texts went (for the author, as the spec's `start.world` takes ids only):
  - `front-north` summary (reworded, B9): "A new front opens: something stirs in the deep north." Fact `front-north-open`: "The north front is open."
  - `front-wildzone-sites` summary: "A new front opens: the old dungeons spill over." Fact `front-wildzone-sites-open`: "The wildzone sites front is open."
- Not changed here: `wears` (A10). The B6/B7 endings were added later the same night: see "Tuning (lead, 18 Nov night)".

## Tuning (lead, 18 Nov night)

Applied to `pack.json` of this copy only (owner: use the lead's recommendations overnight). The pack as it was before this section is kept as `pack.before-tune.json`.

**How it was tested.** I ran the engine's daily step (origin/world/engine with WEFIX1, 54229ce2b) on seeds `lorecheck-0` to `lorecheck-19`:
- 5 game years at tempo 1 and at tempo 2.
- Also 10 years at tempo 2, because the gradual crown (58-106 months) and siege (54-84) fall after year 5.
- No Director; open templates take their fallbacks.

Scripts and raw results are in `scratch/lorecheck/packtune/`, and the full write-up is in `scratch/batch/SMALL/night/PACKTUNE.REPORT.md`.

**Why the threads missed.**
- Long chains of "likely" stages (70% each) lapsed, and each lapse took the rest of the chain with it:
  - Tide named: frostbound × north lost ≈ 49%.
  - Crown: race × war × Marrowbridge × crown ≈ 24%.
- The 45-day realm timer starved a few stages whose windows sit right after another major in the same realm.
- Once a chain died, several crises had nothing left that could end them.

Each change below: path, old → new, why. The texts of the new endings are one plain sentence each.

**1. Backbone stages made certain** (the plan treats each step as what happens next):
- `succ-race` certainty likely → set-in-motion: the race begins as the prologue ends (§3). It lapsed or was cap-blocked in 7/20 runs, and then the whole Succession never happened.
- `succ-war` likely → set-in-motion; `succ-marrowbridge` likely → set-in-motion: "then war, Marrowbridge and a crown" (§3). Only 6/20 runs reached the war.
- `succ-crown-wh`, `succ-crown-wc`, `succ-crown-hc` likely → set-in-motion: the Diet crowns one of the two left after Marrowbridge.
  - Even with everything before it certain, the crown came in only 10/20 runs and left `crown-contested` for good.
  - The three still pre-empt each other, so who is crowned stays weighted by the powers.
- `tide-frostbound-south` likely → set-in-motion, and `pre_empted_by` (absent) → `["fact:tap-closed"]`: the Tide's first stage (§6a, §14).
- `tide-north-lost` likely → set-in-motion, and `pre_empted_by` (absent) → `["fact:tap-closed"]`: the north lost leads to the Tide named. These two had the Tide named in only 7/20 runs.
- Why the pre-emption: a set-in-motion event fires on its last day even when `less_if: fact:tap-closed ×0` holds. The pre-emption (the form `star-second-attempt` uses) keeps "closing the tap stops the north being lost". `less_if` is unchanged.

**2. Endings for the long crises (LORECHECK B6/B7; README item 16, reworked):**
- `succ-crown-wh/wc/hc` `effects.clear` + `slaves-pressed@highmark-empire-realm`. Foundations: slaves-pressed "is cleared when the works or the war end". The crown ended the war but left it set in 18/20 runs.
- `succ-recoinage` certainty possible → likely: it is the Economic War's main ending (§2), and at 15% the clipped coin and the tolls stayed for good.
- New `econ-clipped-coin-ends` (after `succ-recoinage`):
  - likely; requires `tolls-raised@ledger-locks`; window after `lapsed:succ-recoinage + 30 days`, within 1 year.
  - Clears what the recoinage clears; Highmark Coin +15.
  - It opens only once the recoinage can no longer fire (including tolls without a debasement), so it never pre-empts it.
  - Text: "The river towns and the banks force Highmark's hand: honest silver again, and the Ledger Locks tolls come down."
- New `faith-peace` (after `faith-ending`):
  - likely; requires `at-war@holy-dominion-of-aurelion`; window after `lapsed:faith-ending + 1 season`, within 1 year.
  - Clears `at-war` on Aurelion and Ashmere.
  - Text: "The War of Faiths burns out: both hosts are spent, and a winter truce becomes a peace."
- New `war-ardelia-ashkar-truce` (after `war-ardelia-ashkar`):
  - likely; requires `at-war@ashkaran-dominion`; pre-empted by `fired:war-truce` or `fired:war-spreads`; window after `fired:war-ardelia-ashkar + 1 year`, within 1 year.
  - Clears `at-war` on Ardelia and Ashkaran. It is the only ending in the Ashkaran branch, where `war-truce` is always replaced.
  - It is pre-empted once the war spreads because `at-war@ardelian-empire` is one shared condition: without that, it ended the Highmark–Ardelia war too (seen once).
  - Text: "Ardelia and the Ashkaran Dominion agree a border along the Glass Wastes' edge and end the war."
- New `war-exhaustion` (after `war-truce`):
  - likely; requires `fired:war-highmark-ardelia` and any of the six conditions `war-truce` clears; window after `lapsed:war-truce + 1 season`, within 1 year; clears the same six.
  - It covers the Highmark–Ardelia war when `war-spreads` or `war-truce` lapses, which left `at-war` or `garrisons-away` on Ardelia for good (2 runs, 10 years at tempo 2).
  - The requirement stops it ending the Succession war on its own when `war-truce` lapses by cascade with no Ardelia war.
  - Text: "Spent on every border, the armies of the Continental War go home without a treaty."
- New `war-chieftains-peace` (after `war-highmark-chieftains`):
  - likely; requires `at-war@united-chieftainates-realm`; pre-empted by `fired:war-spreads` or `fired:war-truce`; window after `fired:war-highmark-chieftains + 1 year`, within 1 year.
  - Clears `at-war` on the Chieftainates and Highmark.
  - It covers a Chieftains war without an Ardelia war: there `war-truce` cascades, and `at-war@united-chieftainates-realm` stayed for good (1 run, 10 years at tempo 2).
  - Text: "Highmark and the United Chieftainates make peace over the runaways, and the eastern border war ends."
- New `under-shackles-truce` (after `under-crown-debt`):
  - likely; requires `at-war@free-city-of-shackles`; window after `fired:under-crown-debt + 1 season`, within 1 year.
  - Clears `at-war` on Shackles and Highmark. Before, `at-war@free-city-of-shackles` had no clearer at all.
  - Text: "The crown and the Free City of Shackles settle the debt by treaty, and the war ends."
- `succ-contest-settles` (item 16) was **not** added: with the crown stages certain, `crown-contested` always ends with a crown.

**3. Caps and runaway:**
- `succ-reign-north`, `succ-reign-south`, `succ-reign-archive` `window.within` "30 days" → "60 days". The window (crown + 30, within 30 days) closed inside the 45-day Highmark timer that the crown itself sets.
- `auv-sealwardens-recruit` severity (absent) → "minor": a pressure, not a turning point. Its window sits inside the Auvoth timer that its own anchor sets (cap-blocked in 8 runs; fired 5/20).
- `econ-ledger-buys` severity (absent) → "minor": a pressure (one-season debts, Grey Ledger +5) that shares the first months with the race and the debasement under the Highmark timer. Fired 9/20; widening the window to 105 days only gave 10/20.
- `under-contracts` severity (absent) → "minor": a pressure (Hand of Oblivion +10). It opens when `succ-war` sets `at-war`, whose own Highmark timer blocks half its window. Fired in 10 of 20 wars; a 135-day window gave the same.
- `faith-veil-gathers` cooldown "1 season per place" → "1 season": plan §9 says cooldown 1 season. "Per place" let it fire in each of its 7 regions, 6.1 times a year.
- `auv-last-signal` `pre_empted_by` (absent) → `["fact:auvoth-held"]`. When Auvoth held, this set-in-motion stage lapsed with an engine warning (8 per 20 runs once the siege happens). Now it ends quietly.

**Before / after** (runs out of 20; m = months after 1 Oct 611; the window is plan §14's, normal column at tempo 1 and gradual at tempo 2). "No live clearer" means the condition holds at the end and every event that could clear it is finished or can no longer open:

| | Before, tempo 1 | After, tempo 1 | Before, tempo 2 | After, tempo 2 | Before, tempo 2, 10 yrs | After, tempo 2, 10 yrs |
|---|---|---|---|---|---|---|
| Succession race starts | 13/20 (median m4) | 20/20 (median m4) | 7/20 (median m8) | 20/20 (median m9) | 7/20 (median m8) | 20/20 (median m9) |
| Emperor's death public | 13/20 (median m27, 11 in 22-34) | 20/20 (median m26, 17 in 22-34) | 6/20 (median m53, 6 in 44-68) | 17/20 (median m51, 17 in 44-68) | 7/20 (median m54, 7 in 44-68) | 20/20 (median m52, 20 in 44-68) |
| Crowned (succ-crown-*) | 1/20 (median m43, 1 in 29-53) | 20/20 (median m40, 20 in 29-53) | 0/20 | 0/20 | 0/20 | 20/20 (median m77, 20 in 58-106) |
| North lost | 7/20 (median m23, 7 in 21-27) | 20/20 (median m24, 20 in 21-27) | 10/20 (median m48, 9 in 42-54) | 20/20 (median m48, 19 in 42-54) | 10/20 (median m48, 9 in 42-54) | 20/20 (median m48, 19 in 42-54) |
| Tide named | 7/20 (median m25, 7 in 22-29) | 20/20 (median m25, 20 in 22-29) | 10/20 (median m51, 10 in 44-58) | 20/20 (median m52, 20 in 44-58) | 10/20 (median m51, 10 in 44-58) | 20/20 (median m52, 20 in 44-58) |
| Auvoth siege | 6/20 (median m33, 6 in 27-42) | 16/20 (median m36, 13 in 27-42) | 0/20 | 0/20 | 8/20 (median m74, 6 in 54-84) | 16/20 (median m76, 14 in 54-84) |
| Auvoth walls vote | 5/20 (median m29) | 13/20 (median m35) | 3/20 (median m58) | 4/20 (median m58) | 8/20 (median m63) | 15/20 (median m64) |
| Last Wall | 3/20 (median m47, 3 in 42-57) | 8/20 (median m50, 8 in 42-57) | 0/20 | 0/20 | 5/20 (median m96, 5 in 84-114) | 8/20 (median m99, 8 in 84-114) |
| Debasement | 10/20 (median m8, 9 in 4-10) | 11/20 (median m8, 11 in 4-10) | 9/20 (median m17, 9 in 8-20) | 10/20 (median m16, 10 in 8-20) | 9/20 (median m17, 9 in 8-20) | 10/20 (median m16, 10 in 8-20) |
| Recoinage (main coin ending) | 0/20 | 9/20 (median m48) | 0/20 | 0/20 | 0/20 | 6/20 (median m96) |
| Runs with a war/crisis condition left with no live clearer | 19/20 (at-war, coin-debased, crown-contested, slaves-pressed, tolls-raised) | 0/20 | 10/20 (at-war, coin-debased, crown-contested, tolls-raised) | 0/20 | 14/20 (at-war, coin-debased, crown-contested, garrisons-away, slaves-pressed, tolls-raised) | 2/20 (at-war) |
| Average distinct events fired | 36.5 | 50.5 | 31.4 | 38.2 | 37.4 | 51.0 |
| Cap blocks (all events, per run) | 5.8 | 5.0 | 3.5 | 2.8 | 5.0 | 6.3 |
| faith-veil-gathers fires per year | 6.1 | 2.5 | 2.5 | 1.2 | 2.9 | 1.3 |
| Tide conditions (tide-touched / wild-breaking) at the end, regions per run | 6.3 | 8.0 | 4.0 | 5.0 | 7.2 | 8.8 |

Notes on the table:
- **Tide named:** 20/20 inside 22-29 months (tempo 1) and 44-58 (tempo 2).
- **Emperor's death:** 20/20; 3 runs at tempo 1 land at month 21, a little before 22.
- **Crown:** 20/20 inside 29-53 (tempo 1) and 58-106 (tempo 2, 10 years).
- **Auvoth's siege:** 16/20. It stays likely: the 4 misses are the 30% roll. 3 runs at tempo 1 fall at months 43-44.
- **Wars and debasement:**
  - At tempo 1 and at tempo 2 over 5 years, no run ends with a war, debasement or contested crown that nothing can still end. Before tuning this was 19/20 and 10/20 runs.
  - At year 5 (tempo 1) some endings are still pending: the faith war in 4 runs, the coin in 1-2.
  - Over 10 years at tempo 2, 2 runs keep an `at-war`. In each, the new likely fallback (`war-chieftains-peace`, `war-exhaustion`) missed its own 30% roll.
  - To close that last gap, those fallbacks could be made set-in-motion. They would then need pre-emptions for when the war ends another way, so I did not.
- **Recurring events:** none run away. The highest are `faith-veil-gathers` (2.5 a year) and the front pushes (2 a year).
- **Caps:** blocks per run go from 5.8 to 5.0 at tempo 1. The four stages they starved now fire near their odds: `econ-ledger-buys` 9 → 14/20, `under-contracts` 10 → 16 of 20 wars, `auv-sealwardens-recruit` 5 → 11/20, and `succ-reign-*` are no longer shut out.
  - Still blocked often but near their odds: `econ-tolls` (15 blocks, 14/20) and `econ-debasement` (11/20).
  - `up-broken-chain` (12/20, below its 70%) is left as is.
  - Over 10 years at tempo 2 blocks rise (5.0 → 6.3), mostly the `reconstruction` template after Auvoth falls more often.
- **Validation:** the validator gives the same result as before (no new errors or warnings). The one error is the host-version check against this engine build (0.1.0). The pack has 103 events (was 97), and compact JSON is about 502 KB.

**Not changed:**
- **A1, the Tide's conditions:** `tide-touched` and `wild-breaking` are still cleared only by the Director's `open-recovery`. The plan says a front recedes "only when its region is held or cleared", and closing the tap only stops the climb. There is no authored hook to hang a clear on. (Settled in "Final pass": not needed, as designed.) Without the Director they grow to about 8 regions per run by year 5.
- **A2:** the engine now rolls the major templates `reconstruction` and `resettlement` without the Director. `fallen@auvoth` was cleared in 7 of the 8 tempo-1 runs where Auvoth fell, so nothing was needed.
- **Optional, left as is:**
  - `auv-second-surge` is still likely (13/20); the Depths front hangs on it.
  - `up-broken-chain` still loses some rolls to the Highmark timer (12/20 runs).

## Check results (short)

These are the results for the pack **as first written**. Every problem below was fixed afterwards ("Fixes applied", "Tuning", "Final pass"); the current results are in "Final pass (lead, 18 Nov)".

Full results: `scratch/batch/SMALL/night/LORECHECK.REPORT.md`. Tested with 3 game years × 20 seeds at tempo 1 and 2, using the engine's daily step.

- **Clean:**
  - Every id, ref and scope resolves, and there are no dependency cycles.
  - Every fact that is read has a writer, and every condition that is read has a setter.
  - Every named move has `from`, and every companion death has `even_in_party`.
  - No secret gate is impossible.
- **The threads run far behind the pace table (§14).** At tempo 1, after 3 years:
  - Tide named: 8/20 runs.
  - Emperor's death public: 7/20.
  - Crown: 0/20.
  - Auvoth's siege: 1/20.
- **Why, mainly:** long chains of "likely" stages (70% each) lapse, and a lapse takes the rest of the chain with it. Several chains then dead-end and leave a war or crisis in place for good: `crown-contested`, the faith war, the Ardelia–Ashkar war, the clipped coin.
- **Why, second:** all 100 events count as majors, so recurring pressures use up each realm's 45-day timer. `faith-veil-gathers` alone fires about 4 times a year.
- **Two recurring events run away:** `tide-turning` and `tide-ebbs` (100% per season with a per-place cooldown).
- **Two stages can never fire:** `bw-isbro-burns` and `auv-sealwardens-recruit`. Each window closes inside the 45-day timer that its own anchor event sets.
- **Engine side (not yours):** the current engine refuses several v0.14 fields, and does not yet run season anchors, `on`/`date:`, threshold modifiers, weight expressions, `start.world` or `content.regions`. It also counts the file's text size (624 KB pretty-printed, against a 512 KB limit; 499 KB compact).

## Still for the author

**Nothing.** Every item that was listed here has been resolved in the pack or marked not needed, with the reason; the list and what happened to each item are in "Final pass (lead, 18 Nov)" below. The choices made on your behalf are listed there too, so you can change any of them later. None of them is needed to play.

## Wears shortened (lead, 18 Nov)

The 12 cast `wears` texts that ran over 300 characters were rewritten to 300 or fewer (owner request; portraits carry the fine detail). No other field changed.

- **asphodel**: 428 → 279 characters ("decoy" removed in the Final pass: it gave away a secret). Hair in one thick braid, a pale asphodel pinned above one ear. Deep purple gold-worked hooded cloak, hood up, folded over her wings in company. Cream ruffled blouse under a buckled leather corset. Amethyst earrings and jewelled necklace, many rings, a belt pouch of sealed notes.
- **barney**: 352 → 284 characters. Battered brown felt hat with a red and a white feather. Patched rust, brown and green plaid waistcoat with far too many pockets, gold pocket watch on a chain, red neckerchief, rolled sleeves and trousers. A briar pipe, and three walnut shells and a green pea somewhere in his fingers.
- **gorm**: 381 → 298 characters. Beard in braids with silver cuffs and tiny bells; round spectacles on a chain. Deep violet envoy's robe with gold grape-leaf border over a bronze waistcoat, wine-spotted cuffs. A heavy gold chain of office when he remembers it, a grape-embossed flask, a rune-knotted dwarven war-hammer at his belt.
- **harrak**: 439 → 282 characters. Long grey hair loose, one thin braid in an iron ring. Heavy dark cloak under a frost-rimed white fur mantle; dark leather tunic, no clan colours; arms bandaged wrist to shoulder. A silver-banded bone beacon-horn at his belt; a long-hafted great axe he leans on like a walking stick.
- **hush**: 317 → 254 characters. Translucent hooded rain-cloak like running water over a damp grey-mauve coat-dress; crossed leather belts, a brass-studded satchel with a stoppered glass jar clipped to it. A long brass lamplighter's pole and a plain brass oil lantern, never a bound one.
- **nerissa**: 492 → 298 characters. Scallop shells and sea-glass threaded through her hair; the transparent breathing sheath at her throat like a sheer iridescent scarf. Dark plum gold-embroidered privateer's coat slipping off one shoulder, a red sash hung with gold medallions, a gilt basket-hilted cutlass. Barefoot when she can be.
- **nysseth**: 357 → 260 characters. Short, ragged silver-gold hair over one eye (the Ledger sold her long hair). Hooded dark-brown cloak over close dark layers; forearms wrapped in pale cloth. Belts of sheathed knives, and more where you would never look. Usually a whetstone and a knife in hand.
- **rika**: 372 → 288 characters. White hair in a high messy ponytail with red cord. Patched, oversized hooded Startrace travelling coat, insignia torn off; ruffled blouse, red sash, ragged layered skirts. Fingerless gloves; a tasselled red knotted cord at her throat; a star-stamped book at her hip; a small glowing vial.
- **sir-lothar**: 377 → 284 characters. Golden hair in a low tail with a dark ribbon bow. Immaculate engraved silver Iron Guard plate with gold filigree; deep violet gold-embroidered cloak, a white swan brooch on a braided gold cord. A violet gold-tooled book of poems at his hip; a longsword with an ornate gold crossguard.
- **temiwa**: 379 → 289 characters. Off-white gold-edged veil between her ears, the gold flame-sun cross on its fall. Threadbare mauve-brown habit cut for a slimmer novice, straining at its gold buttons; long tabard with the flame-sun at the hem. Brass censer and flame-cross pendants on belt chains. Smells of lye and smoke.
- **torka**: 382 → 279 characters. Braids threaded with bone and fang beads, one per kill. Red war-paint smeared across one cheek and eye. White fur mantle pinned with a bronze disc, laced cream top, tattered fur-trimmed skirt, limbs wrapped in cloth and leather. A fang charm at her belt; a huge spiked iron maul.
- **ysmeth**: 388 → 298 characters. Ash-blonde crown braid, long loose hair behind. Gold-and-brass rune-collar with a heavy ring at the throat, of her own design. Loose shirt under leather harness straps; forearms wrapped in dark cloth. A chisel pouch and a ring of brass keys; a rune-carved forge hammer whose runes glow like embers.

## requires fixed (lead, 18 Nov)
`requires.storyBlock: "^2.31.1"` → `requires.suite: "^0.1"` (the 0.1.0 host checks `suite`; the old key refused the install).

## Final pass (lead, 18 Nov)

The last pass over every open item, using the lead's recommendations (owner, 18 Nov 08:20). `pack.before-final.json` is the pack as it was before this pass.
- **30 changes.** Each is listed below as old → new and why; the 14 name lists are given as examples.
- **Full record:** every change with its exact old and new values is in `scratch/lorecheck/lorefinal/changes.json`, written by `final.py`, which rebuilds the pack from the backup.
- **Diff:** a structural diff shows exactly these paths and nothing else.

**Changes**
1. **Name lists keyed by region id** (all 14 cultures). Places now hold region ids, and the name picker matches a culture's `regions` against the scene's region. The display fragments ("River Confederacy", "Ardelian") therefore matched only 10 of the 30 regions. Each fragment is now the list of region ids it covered under the old region names, and the culture order is unchanged.
   - `river`: "River Confederacy", "Shornmarch" → `confederacy-heartland`, `bluewatch-reach`, `ledger-locks`, `shornmarch`.
   - `sea`: "Tidebound" → `stormmere-isles`.
   - `ardelia`: "Ardelian" → `ardelian-empire-and-southmarch`.
   - The other 11 follow the same rule.
   - Checked with the engine's own `pickSuggestions`: 20 of 30 regions get a culture, against 10 before, and each region gets the same culture as under the old names.
   - The 10 regions with no culture never had one: Auvoth, Startrace, Shackles, Bloodbound, Wallwright, Silver Mark and four Wilds. Without a list, the narrator chooses the names there.
2. **Secret leaks** (old item 7):
   - `succ-veil-price`:
     - Summary "The Ashen Veil calls in its price for the Emperor's chamber from Sir Lothar: the Iron Archive beneath Crown Keep. {outcome}." → "The Ashen Veil comes to Sir Lothar for the Iron Archive beneath Crown Keep: {outcome}."
     - Its `veil-refused` fact "…was refused its price at Crown Keep." → "The Ashen Veil was refused the Iron Archive at Crown Keep."
     - Why: "price" and "the Emperor's chamber" gave away Lothar's gated `the-veils-price` and pointed at the hidden `emperors-chamber`. What the event makes public is that the Veil wants the Archive, and what Lothar does.
   - `under-durvald-contract` summary: "The Hand of Oblivion's sixty-year-old contract on Durvald Seamrune comes due: {outcome}." → "The Hand of Oblivion comes for Durvald Seamrune: {outcome}." The sixty-year-old contract is Nysseth's `the-open-contract`. Only the Nysseth outcome opens that secret, and it still does (`nysseth-contract-called`).
   - `ysmeth` secret `her-father`, gate: "meter trust >= 80" → "meter trust >= 80 or fired:under-durvald-exposed".
     - That event makes public that Durvald sold his wife and daughter, and her own public history says her dwarven father sold her, so after it her father is no secret.
     - This uses the pack's own form: 11 other gates already open on "or fired:".
   - `war-highmark-ardelia`, Liese's status: "papers seized; facing the mines" → "papers seized in Highmark's spy-hunt". "Facing the mines" hinted at her gated `her-papers`.
   - `asphodel` wears: "a pale **decoy** asphodel" → "a pale asphodel" (the original wording). "Decoy" came in with the wears shortening and gave away her gated `her-flower`. A word-by-word check of the other 11 shortened `wears` against the originals found no other new detail.
3. **Somner** (old item 10): `homeBase` "Startrace Tower / Ring of Knowledge" → removed.
   - He has no `start`, so the daily step placed him at the Tower, while his status and the lore say he is missing in the north and may be dead.
   - No event moves him or names him in `effects.cast`.
   - His role ("Startrace leyline surveyor") and his tie to Archmaster Quill keep the Tower link.
4. **Lore sentences** (old items 12-14), one sentence each:
   - Bluewatch, new last line: "In August 611 low Wildzone beasts reached the Bluewatch road and the Border marches a season early." This is the `early-flood-611` fact's text, which `start.world` keeps as an id only.
   - Auvoth, new last line: "In August 611 the Depths gates surged at Auvoth; the Sealwardens held, and the Guild called it routine." (`depths-surge-611`; `auv-second-surge` is the second surge.)
   - Emperor Liutmar: "serving his fixed 18-year term:" → "serving his fixed 18-year term, which ends in July 612:". An elected emperor's term end is public, and the narrator now knows it before `south-deadlock` fires on 30 July 612.
   - Sir Volkmar: "champion of the Wardens" → "a champion of the Wardens". Dame Ermengild's role is also "champion of the Wardens", and the lore allows a few; "a" keeps a narrator from merging the two without adding canon.
5. **`description`**: "world-pack spec v0.14.10" → "v0.14.11". v0.14.11 documents `severity` on world events, which this pack uses on 21 of them.
6. **The last two dead ends** (Tuning, 10 years at tempo 2): `war-chieftains-peace` and `war-exhaustion` certainty likely → set-in-motion. `war-chieftains-peace` `pre_empted_by` gains `fired:war-exhaustion`.
   - Each is a fallback ending that only opens once the main ending can no longer come.
   - As "likely", a missed 30% roll left `at-war` for good (2/20 runs).
   - As set-in-motion, the 10-year runs have no such run, with no lapse warnings and no new warnings.
   - By end state, they end only the wars they are written for (see the checks below).
   - The added pre-emption keeps the Chieftains peace from waiting on a war that `war-exhaustion` has already ended.
   - A clear removes a condition whoever set it, so a certain `war-chieftains-peace` would also end a Highmark `at-war` from another war that is still running. In the runs it fired years after the Succession war had ended.
7. **`tide-ebbs` could never fire.** `where` ["deep-northern-apex"] → ["deep-northern-apex", "border-kingdoms", "bluewatch-reach"].
   - A recurring event that names a region is placed only at that region's places whose class is not `none`. Every place in the Deep Northern Apex is wild, range or dungeon (`none`).
   - So with the tap sealed, the Tide never eased: `tide-ebbs` stayed dormant in all 7 runs that sealed it.
   - The new `where` is the north front's own (`front-north-pushes`). The cooldown stays "1 season", so it still eases once a season.
   - Every other recurring event has at least one place it can land on.

**Every earlier open item, and what happened to it**

| Item (old "Still for the author" number / check id) | Now |
|---|---|
| 1 runaway `tide-turning`, `tide-ebbs` (B1) | Fixed (Fixes applied, lead): cooldown "1 season". |
| 2 recurring pressures on the major caps (B5) | Fixed: `severity: "minor"` on 21 events. Spec v0.14.11 (its first ruling) now documents it. |
| 3 two stages that never fire (B2, B3) | Fixed: windows 60 days, `auv-sealwardens-recruit` minor. In the final runs at tempo 1, `bw-isbro-burns` fires in 6 of 20 runs and `auv-sealwardens-recruit` in 11. |
| 4 chains that rarely complete (B6) | Fixed (Tuning): backbone stages set-in-motion; the targets hold (table below). |
| 5 dead ends (B7) | Fixed: six endings (Tuning) plus change 6. No run ends with a war or crisis that nothing can still end: tempo 1 and 2 over 5 years, and tempo 1 and 2 over 10. |
| 6 deaths of people not yet met (B8) | Fixed: `canDieUnmet: true` on Durvald and Sir Lothar. The engine now also writes "(<name> survived)" on any skipped death (ruling 49). |
| 7 secret leaks (B9, A4) | Fixed: `front-north` (Fixes applied, lead); the other four plus Asphodel's wears in change 2. |
| 8a Tide conditions cleared only by the Director (A1) | **Not needed (as designed).** The thread plan: "Closing the tap … stops the Tide getting worse … Each front recedes only when its region is held or cleared." The foundations name the clearing path: `tide-touched` and `wild-breaking` are cleared by "stepped down a front's ladder (a front held, open-recovery)". That ladder is the Director's `open-recovery`, so with the Director on, the Tide steps back. With it off, the fronts only spread (about 8-9 regions per run by year 5-10). Closing the tap now eases Tide Pressure each season (change 7). |
| 8b `fallen@auvoth`, `evacuated@bluewatch-village` (A2) | Not needed: the engine rolls `reconstruction` and `resettlement` without the Director now. |
| 9 `open-ambition` moving needed figures (A3) | Fixed (Fixes applied, lead): its cast menu is removed. Every non-protected person is one your events place, so an id list would be empty. |
| 10 Somner's place (A5) | Fixed: change 3. |
| 11 day-one fronts (A6) | Fixed: their state is in `start.world`. The two "a new front opens" lines are not needed: `start.world` makes no news by design, and the first pushes report the fronts. |
| 12 pre-start facts lost their text (A7) | Fixed: change 4. |
| 13 Liutmar's term (A8) | Fixed: change 4. |
| 14 two Warden champions (A9) | Fixed: change 4. |
| 15 `wears` over 300 characters (A10) | Fixed: "Wears shortened" (all now 254-298 characters); the one leak it brought in is fixed in change 2. |
| 16 suggested endings | Fixed: applied with reworked windows (Tuning). `succ-contest-settles` is not needed: the crown stages are certain, so `crown-contested` always ends with a crown. |
| Events that never fire in the final runs | Each for a reason, none a fault (see below). |
| Engine gaps E1-E14 (LORECHECK) | Not for the pack, and all are closed in the engine (426b2be). The install check passes with 0 errors and 0 warnings. The step reads threshold modifiers, weight expressions, season anchors, `on`/`date:`, `start.world` and `content.regions`. It has the once-per-season roll (`season-chance.js`) and opens same-day anchors (ruling 51). The size limit is 1 MB. Spec v0.14.11's five rulings cover E10, E12, E13 and E14. |
| Tuning: "certain, not surprising" Succession and Tide | Kept, the lead's choice: the plan's §14 timeline expects these turns in every world. What stays open is when, who falls at Marrowbridge, who is crowned, and the siege. |
| Tuning: shared condition keys | The one case seen was fixed in Tuning round 5. Change 6's note covers the remaining risk. |
| Tuning: the six new endings' texts | Kept: the lead's wording stands (owner, 18 Nov). |
| Tuning: `auv-second-surge` (likely, 13/20), `up-broken-chain` (12/20), Last Wall (8/20) | Not needed: they are meant to be uncertain, and none is a timeline target. |
| PF4PLAN: names cultures keyed by display fragments | Fixed: change 1. |
| PF4PLAN: `tastes` loses `like` | **Not a pack change.** The pack uses spec §8's exact shape `{item, like, why}`. The current people module reads `{sign, item, from}`, and renaming would break the spec, which allows only the §8 shapes. The pack-format-4 conversion maps `like` → `sign` and `why` → `from`. |
| PF4PLAN: NPC State's seeder reads legacy cast field names; Level, Abilities, Keepsakes; unread `markets`/`theme`/`skills`; climate | Not pack changes: the pack follows the spec's field names. These are engine and format-4 jobs, and none needs the author. |
| Lore read coverage | Unchanged from LORECHECK. About 100 culture, economy, bestiary and geography entries were only swept by pattern, not read line by line, and this pass did not re-read them. |

**Events that never fire in the final runs** (no Director and no player), and why:
- **Learned secrets or the party:** `up-fault-word`, `up-crown-keep-dark`, `under-old-debt` and `under-durvald-exposed` open on a learned secret (`fact:collector-book-known` is written by one).
- **Rare branches** (possible or likely, behind another rare event), with their endings:
  - `war-ardelia-ashkar` and `war-ardelia-ashkar-truce`;
  - `war-highmark-chieftains` and `war-chieftains-peace` (tempo 1);
  - `war-exhaustion` (only after a truce lapses following an Ardelia war);
  - `under-vargate`, `under-crown-debt` and `under-shackles-truce` (tempo 1; the debt waits for the crown);
  - `south-highmark-march` (needs Corvin crowned);
  - `econ-privateers` and `star-second-attempt` (possible).
- `tide-ebbs` was the one fault (change 7). With the fix it fires in every run that seals the tap (5 of 5 at tempo 1; 2 of 2 at tempo 2 over 10 years), once a season: seed 8 sealed it at day 1074 and it fired 9 times in the 8 seasons that followed.

**Checks on the final pack**
- **Install check** (`packs/validate.js`, origin/world/engine 426b2be, run on the exact bytes): OK, **0 errors, 0 warnings**. Size: 627,868 bytes as written and 501,552 compact, against the 1 MB limit.
- **Cross-reference scripts** (`scratch/lorecheck/logic.py`, `logic2.py`): `logic2` output is unchanged. `logic.py` differs only in the realm-load lists (`tide-ebbs` now counts in the River Confederacy and the Border Kingdoms; it is minor, so it is off the major caps) and in change 6's two certainty markers.
- **Simulation:** engine 426b2be daily step, 20 seeds (`lorecheck-0..19`), no Director and no player.
  - "Before" = `pack.before-final.json`. It gives exactly the Tuning's final numbers on this newer engine, so the engine has not drifted.
  - "After" = this pack.

| | Before, tempo 1 | After, tempo 1 | Before, tempo 2 | After, tempo 2 | Before, tempo 1, 10 yrs | After, tempo 1, 10 yrs | Before, tempo 2, 10 yrs | After, tempo 2, 10 yrs |
|---|---|---|---|---|---|---|---|---|
| Succession race starts | 20/20 (median m4) | 20/20 (median m4) | 20/20 (median m9) | 20/20 (median m9) | 20/20 (median m4) | 20/20 (median m4) | 20/20 (median m9) | 20/20 (median m9) |
| Emperor's death public | 20/20 (median m26, 17 in 22-34) | 20/20 (median m26, 17 in 22-34) | 17/20 (median m51, 17 in 44-68) | 17/20 (median m51, 17 in 44-68) | 20/20 (median m26, 17 in 22-34) | 20/20 (median m26, 17 in 22-34) | 20/20 (median m52, 20 in 44-68) | 20/20 (median m52, 20 in 44-68) |
| Crowned (succ-crown-*) | 20/20 (median m40, 20 in 29-53) | 20/20 (median m40, 20 in 29-53) | 0/20 | 0/20 | 20/20 (median m40, 20 in 29-53) | 20/20 (median m40, 20 in 29-53) | 20/20 (median m77, 20 in 58-106) | 20/20 (median m77, 20 in 58-106) |
| North lost | 20/20 (median m24, 20 in 21-27) | 20/20 (median m24, 20 in 21-27) | 20/20 (median m48, 19 in 42-54) | 20/20 (median m48, 19 in 42-54) | 20/20 (median m24, 20 in 21-27) | 20/20 (median m24, 20 in 21-27) | 20/20 (median m48, 19 in 42-54) | 20/20 (median m48, 19 in 42-54) |
| Tide named | 20/20 (median m25, 20 in 22-29) | 20/20 (median m25, 20 in 22-29) | 20/20 (median m52, 20 in 44-58) | 20/20 (median m52, 20 in 44-58) | 20/20 (median m25, 20 in 22-29) | 20/20 (median m25, 20 in 22-29) | 20/20 (median m52, 20 in 44-58) | 20/20 (median m52, 20 in 44-58) |
| Auvoth siege | 16/20 (median m36, 13 in 27-42) | 16/20 (median m36, 13 in 27-42) | 0/20 | 0/20 | 16/20 (median m36, 13 in 27-42) | 16/20 (median m36, 13 in 27-42) | 16/20 (median m76, 14 in 54-84) | 16/20 (median m76, 14 in 54-84) |
| Auvoth walls vote | 13/20 (median m35) | 13/20 (median m35) | 4/20 (median m58) | 4/20 (median m58) | 13/20 (median m35) | 13/20 (median m35) | 15/20 (median m64) | 15/20 (median m64) |
| Last Wall | 8/20 (median m50, 8 in 42-57) | 8/20 (median m50, 8 in 42-57) | 0/20 | 0/20 | 8/20 (median m50, 8 in 42-57) | 8/20 (median m50, 8 in 42-57) | 8/20 (median m99, 8 in 84-114) | 8/20 (median m99, 8 in 84-114) |
| Debasement | 11/20 (median m8, 11 in 4-10) | 11/20 (median m8, 11 in 4-10) | 10/20 (median m16, 10 in 8-20) | 10/20 (median m16, 10 in 8-20) | 11/20 (median m8, 11 in 4-10) | 11/20 (median m8, 11 in 4-10) | 10/20 (median m16, 10 in 8-20) | 10/20 (median m16, 10 in 8-20) |
| Recoinage (main coin ending) | 9/20 (median m48) | 9/20 (median m48) | 0/20 | 0/20 | 9/20 (median m48) | 9/20 (median m48) | 6/20 (median m96) | 6/20 (median m96) |
| Runs with a war/crisis condition left with no live clearer | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 | 2/20 (at-war) | 0/20 |
| Average distinct events fired | 50.5 | 50.8 | 38.2 | 38.2 | 52.2 | 52.5 | 51.0 | 51.2 |
| Cap blocks (all events, per run) | 5.0 | 5.0 | 2.8 | 2.8 | 5.0 | 5.0 | 6.3 | 6.3 |
| faith-veil-gathers fires per year | 2.5 | 2.5 | 1.2 | 1.2 | 2.6 | 2.6 | 1.3 | 1.3 |
| Tide conditions (tide-touched / wild-breaking) at the end, regions per run | 8.0 | 8.0 | 5.0 | 5.0 | 10.5 | 10.5 | 8.8 | 8.8 |

- **Tempo 1** (5 and 10 years): every tuned target still holds.
  - Tide named 20/20 inside months 22-29.
  - Emperor's death public 20/20: 17 inside 22-34 and 3 at month 21, as in the Tuning.
  - Crown 20/20 inside 29-53; Auvoth siege 16/20.
  - The only difference from Before is `tide-ebbs` firing in the 5 runs that seal the tap (change 7). Nothing else in those runs changed.
- **Tempo 2:** Tide named 20/20 inside 44-58. Over 10 years: death public 20/20 inside 44-68, crown 20/20 inside 58-106, siege 16/20.
  - At 5 years After is identical to Before seed for seed.
  - At 10 years the differences are change 7 (2 runs) and change 6 (3 runs): seeds 4 and 8 end the Chieftains war, and seed 15 ends the Ardelia war.
  - In all three runs the Succession war had ended years before (crown at day 2197-2468, peace at day 2835-3621), so no other war was cut short.
  - Change 6 does nothing at tempo 1, where these branches never reach their fallbacks within 10 years.
- **Dead ends:** no run in any column ends with a war or crisis that nothing can still end (2/20 before, at tempo 2 over 10 years).
- **Warnings:** no recurring event runs away. The only engine warnings are the open templates' "fallback applied" notes, which are expected with no Director. There is no "set-in-motion lapsed" warning.
