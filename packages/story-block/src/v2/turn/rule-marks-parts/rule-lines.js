// Rule lines: the table of rule names and the test each one applies to a parsed change line.

const DEATH = /(?<![\p{L}\p{N}])(?:died|dies|dead|death|killed|slain|murdered|perished)(?![\p{L}\p{N}])/iu;

/** Any `+ party` line counts, however it parsed. */
const partyJoin = line => (line?.kind === 'party' && line.op === '+') || /^\s*\+\s*party(?![\p{L}\p{N}])/iu.test(String(line?.raw ?? ''));

/** Rule name -> does this parsed change line fall under it? */
export const RULE_LINES = Object.freeze({
    // `? roll Name | skill | difficulty | die`: story checks (lean-rpg/checks). A reply with no mark keeps what it did before: the line is not used.
    checks: line => line?.kind === 'roll',
    // `? roll Name | skill | difficulty`: code gives each check the next die in order (lean-rpg/checks/line.js); a fourth part is tolerated. A reply with no mark keeps the four-part rules and their refusals.
    diceInOrder: line => line?.kind === 'roll',
    // `- key Name | died`: a death counts for anyone, not only a pinned key person (Story Director keypeople). Same words as its death test.
    // `+ party Name`: the room for a companion's blocks (data-modules dmRoom: 20 own, 28 in all) and the party limit counting only active members. Any `+ party` line counts, however it parsed.
    partyRoom: partyJoin,
    // The party holds 4 active members, the reader's character included (lean-rpg/names.js PARTY_ACTIVE; a reply with only `partyRoom` keeps 8). Same lines as `partyRoom`.
    partyFour: partyJoin,
    diedAny: line => line?.kind === 'key' && line.op === '-' && [line.text, ...Object.keys(line.labels ?? {}), ...Object.values(line.labels ?? {})].some(part => DEATH.test(String(part ?? ''))),
    // `+/~/- world Event | factions: A, B`: Story Director names unknown factions from an event's tags (feat/faction-from-events). Any world line counts, so an old reply with one never gains the new creation on Re-read.
    factionTags: line => line?.kind === 'world',
    // A Re-read pays a story XP line at the rate its first run recorded (`xpRate` in its receipt's result), not today's setting (data-modules/part/act.js). Any block line counts.
    xpKept: line => line?.kind === 'dm',
    // The coin line of a one-coin currency worth 1 says what a currency without coins says, "no other coins exist" (domains/money.js moneyLine). Static text: it follows the chat's first reply (persist chatMarked).
    oneCoin: line => line?.kind === 'coin',
    // The `+ party` grammar line names the story's own class field (join.js joinGrammarOwn). Static text: it follows the chat's first reply (persist chatMarked). Same lines as `partyRoom`.
    partyFields: partyJoin,
    // `- party Name`: a Re-read lets the line leave someone its first run made leave, even after the reader's persona was renamed to that name (data-modules/part/party.js). Any `- party` line counts.
    partyLeft: line => line?.kind === 'party' && line.op === '-',
    // A preset's ^ before every word of a change line is dropped when the block is read (capture/lines.js stripCaretWords). It changes how a
    // line is read, not what a parsed line is, so no parsed line falls under it: only a reply's first live capture is marked.
    caretWords: () => false,
    // Foes the narrator has not touched for a few replies no longer start a fight from a typed attack (lean-rpg/precall.js currentFoes). Static per chat: only a reply's first live capture is marked, so an old chat keeps its foes as they were.
    foesFresh: () => false,
    // `! dm foes - cleared` (no kind) clears the one group that stands (data-modules/part/act.js foesClearLine). Static per chat: only a reply's first live capture is marked, so an older reply keeps the line unused on Re-read.
    foesClear: () => false,
    // `~ time` with a month name the calendar does not have ("Redfall 1") is refused with a Problem and the clock stays (Story Director tracker/time.js timeAfter). Static per chat: only a reply's first live capture is marked, so an older reply keeps reading such a line as it did.
    clockMonth: () => false,
    // `~ you rank:` that contradicts the pack's rank data module (Ersveil guild-membership: registered, letter) is left out with a Problem (domains/scene/you.js changeYou). Static per chat: only a reply's first live capture is marked, so an older reply keeps its rank line on Re-read.
    youRank: () => false,
    // With gear on, `~ you wearing:` from the story is left out with a Problem (what is worn is the equipped gear), `outfit:` (lasting) and `look:` (passing, cleared on a move) are kept, each at most 60 characters (domains/scene/you-look.js). Any you line counts.
    youLook: line => line?.kind === 'you',
    // Practice lines can explicitly name a skill and must not credit an arbitrary slot when their reason names several skills.
    skillPractice: line => line?.kind === 'dm' && line.op === '+' && (!line.labels?.kind || /^practice-(?:[1-9]|1[01])$/u.test(String(line.labels.kind))),
    // Only new replies change how the safety net's place lines affect presence or reject conflicting places.
    assistPlace: () => false,
    // A safety-net `+/~ faction` line never sets the stance of a faction the Chronicle already keeps (Story Director chronicle/capture/faction.js, read from `ctx.carrier.assist`). Only new replies; an older reply keeps what its Re-read did.
    assistFaction: () => false,
    // A faction first made during this assist answer may take its stated stance; older replies retain the earlier guard.
    assistFactionFresh: () => false,
    // Judge the safety net's arrivals against the end of a reply only when it carries this mark.
    assistPresent: () => false,
    // A story `+ item` line over its rarity's budget keeps the stats in the order the line wrote them (domains/inventory/story.js statWords). Static per chat: only a reply's first live capture is marked.
    gearOrder: () => false,
    // Quick weapons (cane, rapier, katana, sabre, whip, estoc, scimitar) raise AGI in an item the reply defines (domains/gear/stats.js defaultStat). Static per chat: only a reply's first live capture is marked.
    gearFinesse: () => false,
    // A new item stack's id comes from the receipt's id stream, not the roll stream (domains/inventory/stacks.js newStackId), so a Re-read that adds an earlier `+ item` line keeps the ids of later ones. Static per chat: only a reply's first live capture is marked; an older reply keeps its ids.
    itemIds: () => false,
    // A story `- item X | used: yes` for a consumable restores a pool on the sheet (lean-rpg/board/overrides.js rpg.useItem, asked from domains/inventory/story.js). Static per chat: only a reply's first live capture is marked; an older reply keeps the plain take-away.
    consumableRecovery: () => false,
});
