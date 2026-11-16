// The New character wizard's built-in skill sets.

const skill = (name, stat, about, uses = 'stamina') => ({ name, about, stat, uses });

/**
 * The New character wizard's built-in skill sets (mockup section 4): three skills each, with what the skill does, the stat it
 * rolls with and what it uses. A pack adds more through `content.rpg.skillSets` (same shape, plus its pack id).
 * Ranks are not part of a set: the wizard starts every skill at Novice, one of them at Adept if the reader says so.
 */
export const SKILL_SETS = Object.freeze([
    { id: 'guild-fighter', name: 'Guild fighter', about: 'Drill-yard basics: a blade, the breathing drill that keeps you standing, a shield.', skills: [
        skill('Short blade', 'agi', 'Quick cuts and guards with a long knife or short sword.'),
        skill('Iron Breath', 'vit', 'The drill-yard breathing that keeps you on your feet when you are spent.'),
        skill('Shield work', 'str', 'Holding a line behind a shield: blocking, bracing and shoving back.')] },
    { id: 'river-scout', name: 'River scout', about: 'At home on barges and banks: ropes, cold water, reading tracks in mud.', skills: [
        skill('Rope work', 'dex', 'Knots, climbing, hauling, and throwing a line true.'),
        skill('Swimming', 'vit', 'Cold water, currents, and getting a crewmate out alive.'),
        skill('Tracking', 'int', 'Reading prints, broken reeds and old fires to know who passed and when.')] },
    { id: 'hedge-mage', name: 'Hedge mage', about: 'Self-taught small magic: a spark, a ward, and what the old books say.', skills: [
        skill('Spark', 'int', 'A small bright burst of magic that startles, lights and singes.', 'mana'),
        skill('Ward', 'int', 'A shimmer of force that turns a blow aside for a moment.', 'mana'),
        skill('Lore', 'int', 'What the old books say about creatures, places and odd magic.')] },
    { id: 'field-medic', name: 'Field medic', about: 'Keeps the party alive: bandages, herbs, a steady voice.', skills: [
        skill('Mending', 'dex', 'Bandaging, splinting and stitching a wound fast and clean.'),
        skill('Herbs', 'int', 'Knowing which plants heal, which poison and where they grow.'),
        skill('Calm', 'cha', 'A steady voice that settles the frightened and the hurt.')] },
    { id: 'silver-tongue', name: 'Silver tongue', about: 'Talks the party in and out of things, and pays less for it.', skills: [
        skill('Persuade', 'cha', 'Winning someone round with a good argument and a warm manner.'),
        skill('Read people', 'int', 'Spotting a lie, a worry or a hidden rank from small signs.'),
        skill('Haggle', 'cha', 'Bargaining a price down, or a favour up.')] },
]);
