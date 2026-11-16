// The fixed lexicon from a scanner mood word to its valence, arousal and dominance numbers.

// ---- the scanner's mood word -> the three axes (fixed lexicon, no guessing) ----
// word: [valence, arousal, dominance], each -3..3. Written by hand from the usual circumplex reading (pleasant/unpleasant, keyed up/slack, in control/cornered).

const L = (v, a, d) => Object.freeze([v, a, d]);

export const MOOD_LEXICON = Object.freeze({
    excited: L(2, 2, 1), thrilled: L(3, 3, 1), delighted: L(3, 2, 1), elated: L(3, 3, 2), eager: L(2, 2, 1), amused: L(2, 1, 1), cheerful: L(2, 1, 1), happy: L(3, 1, 1), joyful: L(3, 2, 1),
    proud: L(2, 1, 3), triumphant: L(3, 2, 3), hopeful: L(2, 1, 1), playful: L(2, 2, 1), giddy: L(2, 3, 0), smug: L(1, 1, 3), confident: L(2, 1, 3), determined: L(1, 2, 3), flirty: L(2, 2, 1),
    smitten: L(3, 2, -1), pleased: L(2, 0, 1), flattered: L(2, 1, 0), affectionate: L(2, 1, 0), curious: L(1, 1, 1), bold: L(1, 2, 3), resolute: L(1, 1, 3),
    calm: L(1, -2, 1), content: L(2, -1, 1), relaxed: L(2, -2, 1), relieved: L(2, -1, 1), grateful: L(2, 0, 0), peaceful: L(2, -2, 1), serene: L(2, -2, 1), tender: L(2, -1, 0), fond: L(2, 0, 0),
    warm: L(2, 0, 1), comfortable: L(2, -1, 1), sleepy: L(0, -2, 0), satisfied: L(2, -1, 2), safe: L(2, -1, 1), steady: L(0, 0, 1), stoic: L(0, -1, 2), busy: L(0, 1, 1),
    angry: L(-2, 3, 2), furious: L(-3, 3, 2), enraged: L(-3, 3, 2), irritated: L(-2, 2, 1), annoyed: L(-2, 2, 1), frustrated: L(-2, 2, -1), indignant: L(-2, 2, 2), offended: L(-2, 2, 0), vengeful: L(-2, 2, 2),
    anxious: L(-2, 2, -2), nervous: L(-2, 2, -2), afraid: L(-3, 3, -3), scared: L(-3, 3, -3), terrified: L(-3, 3, -3), panicked: L(-3, 3, -3), alarmed: L(-2, 3, -2), startled: L(-1, 3, -1), tense: L(-2, 2, -1),
    flustered: L(-1, 2, -2), embarrassed: L(-2, 2, -2), mortified: L(-3, 2, -3), ashamed: L(-3, 1, -3), agitated: L(-2, 3, -1), jealous: L(-2, 2, -1), defensive: L(-1, 2, 0), harried: L(-2, 2, -1),
    wary: L(-1, 1, 0), uneasy: L(-1, 1, -1), worried: L(-2, 1, -2), suspicious: L(-1, 1, 1), guarded: L(-1, 0, 1), restless: L(-1, 2, 0), cornered: L(-3, 2, -3), overwhelmed: L(-2, 2, -3),
    bewildered: L(-1, 1, -2), confused: L(-1, 1, -2), puzzled: L(-1, 1, -1), hungry: L(-1, 1, -1), sheepish: L(-1, 1, -2), awkward: L(-1, 1, -2), stunned: L(-1, 2, -2), shocked: L(-1, 3, -2), surprised: L(0, 3, -1),
    defiant: L(-1, 2, 3), scornful: L(-2, 1, 2), stern: L(-1, 0, 2), grim: L(-2, 0, 1), bitter: L(-2, 0, 1), shy: L(-1, 0, -2), hesitant: L(-1, 0, -2),
    sad: L(-2, -1, -1), gloomy: L(-2, -1, -1), miserable: L(-3, -1, -2), hurt: L(-2, 0, -2), lonely: L(-2, -1, -2), tired: L(-1, -2, -1), exhausted: L(-2, -2, -2), bored: L(-1, -2, 0), resigned: L(-2, -2, -2),
    weary: L(-1, -2, -1), disappointed: L(-2, -1, -1), guilty: L(-2, 0, -2), helpless: L(-3, 0, -3), hopeless: L(-3, -1, -3), despairing: L(-3, 0, -3), heartbroken: L(-3, 0, -3), flat: L(-1, -1, 0), numb: L(-1, -2, -1), dazed: L(-1, -1, -2),
    // The words the scanner really wrote in the 11-12 Nov live runs (liverun2, liverun3), and their near neighbours.
    desperate: L(-3, 3, -2), winded: L(-1, 2, -1), mechanical: L(-1, -1, 1), transactional: L(0, 0, 2), shrewd: L(0, 1, 2), brisk: L(0, 2, 2), dry: L(0, -1, 1), wry: L(1, 0, 2), indifferent: L(-1, -1, 1),
    withdrawn: L(-1, -2, -1), cynical: L(-1, 0, 1), spiteful: L(-2, 2, 1), irritable: L(-2, 2, 1), stubborn: L(-1, 1, 2), fed: L(-2, 2, 0), gruff: L(-1, 1, 2), pragmatic: L(0, 0, 2), hurried: L(-1, 2, 0),
    curt: L(-1, 1, 2), vigilant: L(0, 2, 2), stressed: L(-2, 2, -1), urgent: L(-1, 3, 0), cautious: L(-1, 1, 0), calculating: L(0, 1, 2), watchful: L(0, 1, 1), impatient: L(-1, 2, 1), bureaucratic: L(0, -1, 2),
    sharp: L(-1, 2, 2), observant: L(0, 1, 1), measured: L(0, -1, 2), shock: L(-2, 3, -2), agony: L(-3, 3, -3), routine: L(0, -1, 1), blunt: L(-1, 1, 2), businesslike: L(0, 0, 2), methodical: L(0, 0, 2),
    pedantic: L(-1, 0, 2), direct: L(0, 1, 2), procedural: L(0, -1, 2), distrustful: L(-2, 1, 1), inquisitive: L(1, 1, 1), impassive: L(0, -2, 1), important: L(1, 1, 3), crisp: L(0, 1, 2), dismissive: L(-1, 0, 3),
    ridicule: L(-2, 1, -2), rattled: L(-2, 2, -2), contrite: L(-2, 0, -2), skittish: L(-2, 2, -2), violent: L(-3, 3, 2), sore: L(-1, 1, -1), conspiratorial: L(0, 2, 1), aggressive: L(-2, 3, 3), skeptical: L(-1, 0, 1),
    practical: L(0, 0, 2), opportunistic: L(0, 1, 2), mistrustful: L(-2, 1, 1), impressed: L(2, 1, 0), hostile: L(-3, 2, 2), discreet: L(0, -1, 2), frightened: L(-3, 3, -3), exasperated: L(-2, 2, 0), frantic: L(-3, 3, -2),
    rigid: L(-1, 1, 2), alert: L(0, 2, 1), secretive: L(-1, 0, 1), fearful: L(-2, 2, -2), subdued: L(-1, -2, -1), caught: L(-2, 2, -2), breathless: L(0, 3, -1), brusque: L(-1, 1, 2), terse: L(-1, 0, 2), cold: L(-2, 0, 2),
    snappish: L(-2, 2, 2), impulsive: L(0, 3, 1), earnest: L(1, 1, 1),
});
