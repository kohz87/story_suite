// The static prompt text (design §10.4, as approved) and the kinds' one-line grammar.

/** The fixed rules the narrator is given while Text RPG is active. */
export const STATIC_TEXT = [
    'Text RPG: tell every fight, chase, trap and danger as it would really unfold: one flowing scene, no rounds, the key exchanges each with a clear cause, cost and result. Fights follow physical reality: size, numbers, reach, armour, terrain, preparation and surprise decide them, and nobody has plot armour. Foes are as strong as who they are, never matched to the party; the line says how they compare. Most foes want to live: they break, flee or yield when it turns against them.',
    'The sheet line says what each character can do and how much they have left: keep them to it. Wounds, tiredness and fear weigh on what follows.',
    'At the moments that decide the outcome (at most three a reply), write ? try Who | skill or stat | difficulty and work out each result from the dice note and tell it, with its cost. In a fight or other danger add | threat: how the foe compares, in the sheet\'s words (far beneath you … beyond you). A failure still moves the scene: later, poorer, seen, hurt, or a worse version of what was wanted; nothing resets and nobody rescues them in the same beat. Never write numbers, dice or luck.',
].join('\n');

/** The narrator rules: the reader's own text (the `rules` setting, trimmed) when it has some, else the built-in STATIC_TEXT. The grammar lines and the dice note are not part of it. */
export function narratorRules(values) {
    const own = typeof values?.rules === 'string' ? values.rules.trim() : '';
    return own || STATIC_TEXT;
}

/** One short grammar line per kind. */
export const GRAMMAR = Object.freeze({
    try: '? try Who | skill or stat | easy|normal|hard|very hard [| threat: far beneath you|beneath you|a fair match|above you|far above you|beyond you]',
    xp: '+ xp Party — what was overcome | size: minor|real|major|great (once a reply, after a roll)',
    condition: '~ condition Who — poisoned|bleeding|stunned|frightened|exhausted|burning|prone|blinded | until: treated|N hours|cleared',
    injury: '+ injury Who — name | hampers: str, agi | grave: minor|serious|grave',
    skill: '+ skill Who — Name | stat | type | from: how it was learned',
    companion: '+ companion Name | level: N | strengths: a, b',
    fall: '! fall Who — how',
    health: '~ health Who — Unhurt|Scratched|Hurt|Wounded|Badly wounded|Down | why: cause',
    spend: '~ spend Who — skill used',
});
