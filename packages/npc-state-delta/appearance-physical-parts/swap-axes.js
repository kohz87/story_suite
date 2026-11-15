/* The trait axes and colour/shape/length comparison that decides whether two values clash. A part of appearance-physical.js (same owner, moved without change). */
// (card traits win) Every established physical value is protected, regardless of where it came from.
// A missing value may be filled; a contradictory value needs a grounded change event.
const HUES = Object.freeze({
    black: ['black', 'raven', 'ebony', 'jet', 'inky', 'sable', 'coal', 'onyx'],
    brown: ['brown', 'chestnut', 'umber', 'mahogany', 'chocolate', 'coffee', 'walnut', 'russet', 'tawny', 'brunette', 'bronze'],
    hazel: ['hazel'],
    gold: ['gold', 'golden', 'amber', 'honey', 'blonde', 'blond', 'flaxen', 'yellow', 'straw', 'sandy'],
    red: ['red', 'crimson', 'scarlet', 'ruby', 'auburn', 'copper', 'ginger', 'rust', 'vermilion', 'strawberry'],
    white: ['white', 'snowy', 'ivory', 'cream', 'platinum', 'porcelain'],
    grey: ['silver', 'silvery', 'grey', 'gray', 'greying', 'graying', 'ashen', 'ash', 'steel', 'slate', 'pewter', 'iron'],
    blue: ['blue', 'azure', 'sapphire', 'cerulean', 'cobalt', 'navy', 'icy', 'teal', 'turquoise', 'aquamarine', 'cyan'],
    green: ['green', 'emerald', 'jade', 'olive', 'moss', 'teal', 'turquoise', 'verdant'],
    violet: ['violet', 'purple', 'lilac', 'lavender', 'amethyst', 'indigo', 'plum', 'mauve'],
    pink: ['pink', 'rose', 'rosy', 'magenta'],
    orange: ['orange'],
});
const LIGHT_TONES = new Set(['pale', 'light', 'fair', 'bright']);
const DARK_TONES = new Set(['dark', 'deep']);
const LIGHT_TONE_CLASH = new Set(['black', 'brown']);
const DARK_TONE_CLASH = new Set(['white', 'gold']);
const AXES = Object.freeze({
    length: { long: ['long', 'waist', 'hip', 'ankle', 'floor', 'flowing'], shoulder: ['shoulder'], short: ['short', 'cropped', 'shaved', 'bald', 'buzzed', 'shorn', 'chin'] },
    texture: { curly: ['curly', 'curled', 'curls', 'wavy', 'frizzy', 'kinky', 'ringlets'], straight: ['straight', 'sleek'] },
    build: {
        slight: ['slender', 'slim', 'lean', 'lithe', 'lanky', 'willowy', 'wiry', 'skinny', 'thin', 'petite', 'slight', 'gaunt', 'bony'],
        heavy: ['stocky', 'curvy', 'burly', 'brawny', 'muscular', 'plump', 'heavyset', 'stout', 'full', 'broad', 'voluptuous', 'buxom', 'hulking', 'portly', 'rotund'],
    },
    height: { tall: ['tall', 'towering', 'statuesque'], short: ['short', 'diminutive', 'tiny', 'small', 'petite'] },
    shape: { narrow: ['narrow', 'thin', 'slender'], broad: ['broad', 'wide'], pointed: ['pointed', 'sharp'], rounded: ['rounded', 'round', 'blunt'], straight: ['straight'], crooked: ['crooked', 'bent'] },
    position: { left: ['left'], right: ['right'], upper: ['upper'], lower: ['lower'] },
});
export const TRAIT_AXES = Object.freeze({
    hair: ['color', 'length', 'texture'], eyes: ['color', 'shape'], skin: ['color'], fur: ['color'], scales: ['color'], ears: ['color', 'shape', 'length'],
    tail: ['color', 'shape', 'length'], horns: ['color', 'shape', 'length'], wings: ['color', 'shape'], build: ['build'], height: ['height'],
    face: ['color', 'shape'], scar: ['position', 'shape', 'length'], tattoo: ['position', 'shape'], birthmark: ['position', 'shape'],
    fangs: ['shape', 'length'], claws: ['shape', 'length'], antlers: ['shape'], tusks: ['shape', 'length'],
});
const polesOf = (words, poles) => new Set(Object.entries(poles).filter(([, list]) => list.some(word => words.includes(word))).map(([pole]) => pole));
const disjoint = (a, b) => a.size > 0 && b.size > 0 && ![...a].some(pole => b.has(pole));
// Tones only against the other side's hues (or the other tone); a tone beside a hue is a shade of it.
function toneClash(tones, hues) {
    return [...tones].some(tone => (LIGHT_TONES.has(tone) && [...hues].some(hue => LIGHT_TONE_CLASH.has(hue)))
        || (DARK_TONES.has(tone) && [...hues].some(hue => DARK_TONE_CLASH.has(hue))));
}
function colorSwapped(current, incoming) {
    const [nowHues, newHues] = [polesOf(current, HUES), polesOf(incoming, HUES)];
    if (nowHues.size && newHues.size) return disjoint(nowHues, newHues)
        || (current.filter(word => Object.values(HUES).some(list => list.includes(word))).length > 1
            && incoming.filter(word => Object.values(HUES).some(list => list.includes(word))).length > 1
            && [...nowHues].some(hue => !newHues.has(hue)) && [...newHues].some(hue => !nowHues.has(hue)));
    const [nowTones, newTones] = [current, incoming].map(words => new Set(words.filter(word => LIGHT_TONES.has(word) || DARK_TONES.has(word))));
    if (nowHues.size) return toneClash(newTones, nowHues);
    if (newHues.size) return toneClash(nowTones, newHues);
    const light = tones => tones.size > 0 && [...tones].every(tone => LIGHT_TONES.has(tone));
    const dark = tones => tones.size > 0 && [...tones].every(tone => DARK_TONES.has(tone));
    return (light(nowTones) && dark(newTones)) || (dark(nowTones) && light(newTones));
}
export function axisSwapped(axis, current, incoming) {
    return axis === 'color' ? colorSwapped(current, incoming) : disjoint(polesOf(current, AXES[axis]), polesOf(incoming, AXES[axis]));
}
// The words of an axis a text names, for the report ("pale", "brown").
export function axisWords(axis, words) {
    const listed = axis === 'color' ? [...Object.values(HUES).flat(), ...LIGHT_TONES, ...DARK_TONES] : Object.values(AXES[axis]).flat();
    return [...new Set(words.filter(word => listed.includes(word)))];
}
