// The static prompt text (design §10.4, §16 "Narrator rules v2") and the kinds' one-line grammar.

/** The fixed rules the narrator is given while Text RPG is active. */
export const STATIC_TEXT = [
    'Text RPG: tell every danger as it really unfolds, in one scene without rounds.',
    'Roll only when an attempt is possible but uncertain; never roll routine things, thoughts, feelings, decisions or background. One objective, one roll, one skill; one move repeated on one group (picking them off one by one) is one roll for the whole run. A roll never exceeds the character\'s capability or creates a place. Searching, tracking and navigating may be rolled. Use dice in order, skipping the die of a moot action. Name the foe group with against: when several stand; an edge needs a reason.',
    'A natural 20 or 1 changes only how it is told. Costs and failures come only from risks in the scene. Failure is a scene, not a wall: its cost stands and the situation changes; no rescue or reset in the same beat; a retry is new. Then carry on with the reader\'s plan if it still makes sense (their own fallback first), else stop.',
    'The sheet says what each side can do; the matchup line, who should win. Dice tip a close fight, never rescue a lost one; an outmatched side wins only through an edge set up before. Defeat, capture and retreat are ordinary. Foes fight to their strength (flank, focus the wounded, press an advantage) and most want to live; no lucky openings or rescues not set up. When unsure, take the harsher outcome. Badly wounded cannot fight on effectively; Down cannot act.',
    'Set the foes with + foes before a fight: those engaging now, as many as the story shows, each with its kind; a swarm that comes in waves is a group a wave; add none mid-fight except declared reinforcements. + xp only for foes that fell this reply; end foes that fled or were left with - foes. Kinds: vermin: rats; common: bandit, wolf; trained: soldier; elite: troll; monster: wyvern; legend: dragon.',
    'If the reader chains separate fights, play the first and the safe steps after it, then stop as the next fight begins.',
    'For rest or sleep write ~ rest; "restored" in a condition refills nothing.',
    'Every reward must point to something shown on screen this reply. Never write numbers, dice or luck.',
].join('\n');

/** What the matchup line adds to its band, so the narrator reads the rule where the band is. */
export const MATCHUP_RULE = 'Favoured: the party should win. Even: the dice decide. Outmatched: the party loses unless an edge was set up before. Hopeless: no roll saves them.';

/** The narrator rules: the reader's own text (the `rules` setting, trimmed) when it has some, else the built-in STATIC_TEXT. The grammar lines and the dice note are not part of it. */
export function narratorRules(values) {
    const own = typeof values?.rules === 'string' ? values.rules.trim() : '';
    return own || STATIC_TEXT;
}

/** One short grammar line per kind. */
export const GRAMMAR = Object.freeze({
    try: '? try Who | skill or stat | trivial|easy|ordinary|hard|very hard|near impossible [| against: Group name when several foes stand] [| edge: +1 (reason) in their favour, -1 (reason) against; at most 2]',
    xp: '+ xp Party — what was overcome [| foes: how many fell this reply] [| group: Name; name the group when foes are mixed] (pays only foes still standing in the + foes record; once a reply)',
    foes: '+ foes Name | count: N | kind: vermin|common|trained|elite|monster|legend (before the fight; up to 6 groups a reply; the same Name and kind in a later reply = reinforcements); - foes Name when they flee or scatter (no XP)',
    lesson: '+ lesson Who — Skill | what was learned (once a skill a fight, after its foes are down; only a skill they rolled in it)',
    condition: '~ condition Who — poisoned|bleeding|stunned|frightened|exhausted|burning|prone|blinded | until: treated|N hours|cleared',
    injury: '+ injury Who — name | hampers: str, agi | grave: minor|serious|grave',
    skill: '+ skill Who — Name | stat | type | from: how it was learned',
    companion: '+ companion Name | level: N | strengths: a, b',
    fall: '! fall Who — how',
    health: '~ health Who — Unhurt|Scratched|Hurt|Wounded|Badly wounded|Down | why: cause',
    spend: '~ spend Who — skill used (only a skill used without a ? try; a try pays its own cost)',
    rest: '~ rest Who — short|night|day (Party or a name; short: an hour or more, night: a full night, day: a whole day and a stage of healing; mana and stamina refill; not while foes stand)',
    train: '~ train Who — Skill | sessions: N (one a day of training the story told)',
});
