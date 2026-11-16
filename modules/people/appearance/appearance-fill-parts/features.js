/* Which of hair, eyes and build a text already describes or is missing. A part of appearance-fill.js (same owner, moved without change). */
import { patternOf } from './shared-basics.js';

// Generous on purpose: a false "covered" only skips a fill, a false "missing" would invent over written text.
// A kind with no hair (scales, feathers, fur, chitin ...) counts as having its hair described.
const HAIR = new RegExp(`${patternOf('hair').source}|\\b(?:locks?|curls?|curly|tresses|bald|balding|shaved|shorn|buzz(?:ed)?|cropped|mohawk|bun|topknot|plaits?|dreadlocks?|dreads|beard|bearded|hairless|hairstyle|hairdo|fringe|wig|fur|furred|furry|scales?|scaled|scaly|feathers?|feathered|plumage|chitin(?:ous)?|carapace|exoskeleton|shell|bark|hide|slime|gelatinous|spectral|ghostly|incorporeal|skeletal|skeleton|bones?|metal|metallic|plating|stone|wooden)\\b`, 'i');
const EYES = new RegExp(`${patternOf('eyes').source}|\\b(?:gaze|gazes|stare|eyeless|heterochromia|sockets?|visor|glowing\\s+(?:red|blue|green|gold|golden|white|violet|amber)|(?:amber|hazel|emerald|sapphire|violet|golden|gold|green|blue|grey|gray|brown|black|silver|crimson|ruby)[- ]?(?:gaze|stare|orbs?))\\b`, 'i');
const BUILD = new RegExp(`${patternOf('build').source}|${patternOf('height').source}|\\b(?:stocky|stout|sturdy|broad|wiry|muscled|muscular|heavy[- ]?set|heavyset|gaunt|slight|skinny|thin|plump|chubby|portly|rotund|hulking|bulky|athletic|toned|statuesque|tall|short|towering|big|huge|large|small|tiny|giant|waif|waifish|curves|curvaceous|voluptuous|shapely|hourglass|bony|scrawny|spindly|sinewy|stature|size|bodied|body|torso|limbs|height|petite|dwarfish|squat|stubby|corpulent|well[- ]built|fit)\\b`, 'i');
const FEATURES = Object.freeze([['hair', HAIR], ['eyes', EYES], ['build', BUILD]]);

/** Per-feature test: which of hair / eyes / build this text already describes (generous word lists). Pure. */
export function describedFeatures(text = '') {
    const value = String(text ?? '');
    return FEATURES.filter(([, pattern]) => pattern.test(value)).map(([key]) => key);
}

/** The features (hair, eyes, build) a PARTIAL overallAppearance does not describe; [] for a blank text (that is a blank fill). */
export function missingFeatures(text = '') {
    const value = String(text ?? '').trim();
    if (!value) return [];
    const have = describedFeatures(value);
    return FEATURES.map(([key]) => key).filter(key => !have.includes(key));
}
