// The fixed topics a skill word falls under.

/** The fixed topics and the skill words that fall under each (tested against the skill word). */
export const TOPICS = Object.freeze({
    perception: /\b(?:percep\w*|notic\w*|spot\w*|search\w*|look\w*|listen\w*|investigat\w*|insight\w*|awareness|watch\w*|scout\w*)\b/,
    stealth: /\b(?:stealth\w*|sneak\w*|hid(?:e|es|ing)|hidden|creep\w*|prowl\w*|skulk\w*)\b/,
    lock: /\b(?:lock\w*|pick\w*|disarm\w*|trap\w*|sleight\w*|pickpocket\w*)\b/,
    climb: /\b(?:climb\w*|scal(?:e|es|ing)|swim\w*|jump\w*|leap\w*|athlet\w*)\b/,
    strength: /\b(?:strength|lift\w*|carry\w*|break\w*|smash\w*|push\w*|pull\w*|forc(?:e|es|ing)|grappl\w*|wrestl\w*|haul\w*)\b/,
    speed: /\b(?:run|runs|running|chas\w*|dodg\w*|escap\w*|evad\w*|acrobat\w*|reflex\w*|balanc\w*|tumbl\w*|speed)\b/,
    endurance: /\b(?:endur\w*|stamina|fortitude|resist\w*|poison\w*|toughness|constitution|march\w*)\b/,
    will: /\b(?:will|willpower|resolve|courage|fear|nerve|resist\w*|steel\w*)\b/,
    social: /\b(?:social|persua\w*|decept\w*|deceiv\w*|bluff\w*|charm\w*|negotiat\w*|haggl\w*|barter\w*|convinc\w*|perform\w*|intimidat\w*|lie|lying|diplomac\w*|etiquette)\b/,
    lore: /\b(?:lore|arcan\w*|knowledge|histor\w*|recall\w*|deciph\w*|stud\w*|magic|religion|medicine|read\w*)\b/,
    nature: /\b(?:nature|surviv\w*|track\w*|forag\w*|navigat\w*|hunt\w*|wilderness|herb\w*)\b/,
    animals: /\b(?:animals?|ride|rides|riding|tam(?:e|es|ing)|handl\w*|calm\w*|horse\w*)\b/,
    craft: /\b(?:craft\w*|repair\w*|mend\w*|forg(?:e|es|ing)|tinker\w*|build\w*|smith\w*)\b/,
    luck: /\b(?:luck\w*|chance|gambl\w*|fortune|guess\w*)\b/,
});

export const TOPIC_NAMES = Object.freeze(Object.keys(TOPICS));

/** The topics a skill word falls under, in the table's order. */
export const topicsOf = skill => {
    const word = String(skill ?? '').toLowerCase();
    return TOPIC_NAMES.filter(name => TOPICS[name].test(word));
};

