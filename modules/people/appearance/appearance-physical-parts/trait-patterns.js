/* The physical-trait pattern table and the clothing, concealment and size word patterns. A part of appearance-physical.js (same owner, moved without change). */
// Enduring physical traits (hair, eyes, build, scars, anatomy) survive an accepted current-appearance
// update that simply omits them, e.g. an outfit change narrated without restating the body. A trait is
// replaced only when the incoming presentation itself describes that trait (outside a "hidden under"
// style mention). Clothing, gear and transient condition are never carried forward: they follow the
// existing full-current-presentation replacement rule.
export const PHYSICAL_TRAITS = Object.freeze([
    ['hair', /\b(?:hair|haired|braids?|braided|ponytails?|pigtails|bangs|mane)\b/i],
    ['eyes', /\b(?:eyes?|eyed|irises|iris|pupils)\b/i],
    ['skin', /\b(?:skin|skinned|complexion|freckles?|freckled)\b/i],
    ['build', /\b(?:build|frame|figure|physique|muscular|muscles?|slender|slim|lean|lithe|stocky|petite|curvy|lanky|burly|brawny|willowy|broad[- ]shouldered)\b/i],
    ['height', /\b(?:tall|height|towering|diminutive|statuesque)\b/i],
    ['face', /\b(?:face|facial|jaw|jawline|cheekbones|nose|lips|beard|bearded|mustache|moustache|stubble)\b/i],
    ['scar', /\b(?:scars?|scarred)\b/i],
    ['tattoo', /\b(?:tattoos?|tattooed)\b/i],
    ['birthmark', /\b(?:birthmarks?|moles?)\b/i],
    ['ears', /\bears?\b/i],
    ['horns', /\b(?:horns?|horned)\b/i],
    ['tail', /\btails?\b/i],
    ['wings', /\b(?:wings?|winged)\b/i],
    ['fur', /\b(?:fur|furred)\b/i],
    ['scales', /\b(?:scales|scaled)\b/i],
    ['fangs', /\bfangs?\b/i],
    ['claws', /\bclaws?\b/i],
    ['antlers', /\bantlers?\b/i],
    ['tusks', /\btusks?\b/i],
]);
export const CHANGEABLE_PRESENTATION = /\b(?:wear(?:s|ing)?|worn|dressed|clad|outfit|attire|cloth(?:es|ing)|dress|gown|robes?|cloak|cape|coat|jacket|shirt|blouse|tunic|vest|skirt|trousers|pants|leggings|stockings|boots?|shoes?|sandals|gloves?|gauntlets?|hat|hood(?:ed)?|helmet|mask|armou?r|uniform|apron|scarf|belt|sash|jewel(?:ry|lery)|necklace|pendant|rings?|bracelets?|earrings?|ribbons?|carr(?:y|ies|ying)|hold(?:s|ing)|wield(?:s|ing)|sword|staff|dagger|bag|satchel|pack|wet|damp|soaked|drenched|blood(?:ied|y|stained)|mud(?:dy)?|dirt(?:y)?|bruised?|bleeding|wounded|injured|bandaged|sweat(?:y|ing)|flushed|tear[- ]streaked|disheveled|dishevelled)\b/i;
export const CONCEALED_MENTION = /\b(?:hid(?:e|es|den|ing)|cover(?:s|ed|ing)?|conceal(?:s|ed|ing)?|beneath|under(?:neath)?|obscur(?:e|es|ed|ing)|tucked)\b/i;
// Size words describe height only when nothing else in the piece is a trait ("short" alone, not
// "short silver hair").
export const SIZE_ONLY = /\b(?:short|small|tiny|little|huge|giant|massive|enormous|colossal|gigantic)\b/i;
