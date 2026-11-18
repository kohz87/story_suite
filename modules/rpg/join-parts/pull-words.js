// The pull's keyword table (pack format 4, §5.3): the words of an ability's description or a person's role and history, and what each says of a sheet.
// Fixed and ordered, folded to lower case, no locale and no randomness: the same record gives the same sheet on a swipe, a Re-read and a rebuild.

/** [pattern, skill type, stat]: the first row an ability's name and description match gives its type and stat; no match is a plain attack on the lead stat. */
const ABILITY_WORDS = Object.freeze([
    [/\b(heal|mend|cure|restor|bandage|salve|balm|bless|revive|remed)/u, 'heal', 'wis'],
    [/\b(ward|shield|guard|protect|barrier|armou?r|bulwark|brace|deflect|parry|endur)/u, 'defence', 'vit'],
    [/\b(dodge|evade|evasi|sneak|stealth|hide|nimble|slip|vanish|shadow)/u, 'evasion', 'agi'],
    [/\b(rally|inspire|command|lead|aura|encourag|oath|banner|support)/u, 'support', 'cha'],
    [/\b(sprint|dash|leap|climb|swift|charge|stride|vault)/u, 'movement', 'agi'],
    [/\b(sweep|cleave|blast|storm|volley|burst|explo|wave|nova|whirl|barrage)/u, 'area', 'str'],
    [/\b(arrow|bow|shot|shoot|throw|knife|dagger|sling|dart|aim|snipe|trap)/u, 'attack', 'dex'],
    [/\b(spell|arcane|magic|fire|flame|frost|ice|lightning|curse|hex|conjur|sorcer|rune)/u, 'attack', 'int'],
    [/\b(lore|craft|forge|smith|repair|herb|brew|alchem|track|lock|pick|trade|barter|speak|tongue|language|diplom|persuad|charm|read|scribe|cook|navigat|sail|ferry|tinker)/u, 'utility', 'int'],
    [/\b(strike|slash|sword|blade|axe|hammer|spear|punch|kick|smash|brawl|duel|fight|cut)/u, 'attack', 'str'],
]);

/** [pattern, stat]: the words of a role, a history or an ability that lean a person toward a stat (the best stat is the one with the most hits; a tie goes to the earlier stat). */
const LEAN_WORDS = Object.freeze([
    [/\b(warrior|knight|soldier|guard|fighter|mercenary|brawler|smith|sailor|porter|hunter|captain|warden)/u, 'str'],
    [/\b(thief|rogue|scout|ranger|archer|courier|runner|spy|pickpocket|poacher|duelist)/u, 'dex'],
    [/\b(mage|wizard|scholar|alchemist|sage|archivist|clerk|scribe|engineer|inventor|apprentice|witch)/u, 'int'],
    [/\b(healer|priest|monk|oracle|hermit|shaman|herbalist|midwife|pilgrim|seer)/u, 'wis'],
    [/\b(noble|diplomat|bard|merchant|trader|singer|actor|envoy|innkeeper|politician|speaker)/u, 'cha'],
    [/\b(tough|veteran|survivor|stubborn|hardy|miner|farmer|labou?rer)/u, 'vit'],
    [/\b(acrobat|dancer|sprinter|swift|nimble)/u, 'agi'],
]);

const STAT_ORDER = Object.freeze(['str', 'vit', 'agi', 'dex', 'int', 'wis', 'cha']);
const fold = text => String(text ?? '').toLowerCase();

/** `{ type, stat }` an ability's name and description say (the ability table's first match), or null. */
export function abilityWord(text) {
    const said = fold(text);
    const row = ABILITY_WORDS.find(([pattern]) => pattern.test(said));
    return row ? { type: row[1], stat: row[2] } : null;
}

/** The stat with the most hits over a role, a history and the abilities' words (both tables count); '' when nothing hits. A tie goes to the earlier stat in str, vit, agi, dex, int, wis, cha order. */
export function leanStat(texts) {
    const said = texts.map(fold).filter(Boolean);
    const count = Object.fromEntries(STAT_ORDER.map(stat => [stat, 0]));
    for (const text of said) {
        for (const [pattern, stat] of LEAN_WORDS) if (pattern.test(text)) count[stat] += 1;
        const hit = ABILITY_WORDS.find(([pattern]) => pattern.test(text));
        if (hit) count[hit[2]] += 1;
    }
    const best = STAT_ORDER.reduce((top, stat) => (count[stat] > count[top] ? stat : top), STAT_ORDER[0]);
    return count[best] > 0 ? best : '';
}
