// Direct visual anchor tags (hair colour/form, eye colour, build) pulled from appearance text, and the tag-format fallback parts.
import { cleanText } from '../core-text.js';
import { uniquePortraitParts } from './shared-parts.js';

const PORTRAIT_HAIR_COLOR_SURFACE_RULES = Object.freeze([
    { pattern: /\bauburn\b/i, tag: 'auburn hair' },
    { pattern: /\bginger\b/i, tag: 'ginger hair' },
    { pattern: /\bcrimson\b/i, tag: 'crimson hair' },
    { pattern: /\bred\b/i, tag: 'red hair' },
    { pattern: /\bblack\b/i, tag: 'black hair' },
    { pattern: /\bbrunette\b/i, tag: 'brown hair' },
    { pattern: /\bbrown\b/i, tag: 'brown hair' },
    { pattern: /\bblonde?\b/i, tag: 'blonde hair' },
    { pattern: /\bplatinum\b/i, tag: 'platinum hair' },
    { pattern: /\bivory\b/i, tag: 'ivory hair' },
    { pattern: /\bwhite\b/i, tag: 'white hair' },
    { pattern: /\bsilvery\b/i, tag: 'silver hair' },
    { pattern: /\bsilver\b/i, tag: 'silver hair' },
    { pattern: /\bgrey\b/i, tag: 'gray hair' },
    { pattern: /\bgray\b/i, tag: 'gray hair' },
    { pattern: /\bgolden\b/i, tag: 'golden hair' },
    { pattern: /\bgold\b/i, tag: 'golden hair' },
    { pattern: /\bcobalt\b/i, tag: 'cobalt-blue hair' },
    { pattern: /\bazure\b/i, tag: 'azure-blue hair' },
    { pattern: /\bindigo\b/i, tag: 'indigo-blue hair' },
    { pattern: /\bblue\b/i, tag: 'blue hair' },
    { pattern: /\bviolet\b/i, tag: 'violet hair' },
    { pattern: /\bpurple\b/i, tag: 'purple hair' },
    { pattern: /\bpink\b/i, tag: 'pink hair' },
    { pattern: /\bemerald\b/i, tag: 'emerald-green hair' },
    { pattern: /\bgreen\b/i, tag: 'green hair' },
    { pattern: /\borange\b/i, tag: 'orange hair' },
]);
const PORTRAIT_HAIR_FORM_RULES = Object.freeze([
    { pattern: /\b(?:curl|curls|curly)\b/i, tag: 'curly hair' },
    { pattern: /\bwavy\b/i, tag: 'wavy hair' },
    { pattern: /\bstraight\b/i, tag: 'straight hair' },
    { pattern: /\b(?:braid|braids|braided)\b/i, tag: 'braided hair' },
    { pattern: /\b(?:tangled|messy|disheveled)\b/i, tag: 'tangled hair' },
    { pattern: /\b(?:coming\s+loose|loose)\b/i, tag: 'loose hair' },
    { pattern: /\bshoulder[- ]length\b/i, tag: 'shoulder-length hair' },
    { pattern: /\bwaist[- ]length\b/i, tag: 'waist-length hair' },
    { pattern: /\bthigh[- ]length\b/i, tag: 'thigh-length hair' },
    { pattern: /\bhip[- ]length\b/i, tag: 'hip-length hair' },
    { pattern: /\blong\b/i, tag: 'long hair' },
    { pattern: /\bshort\b/i, tag: 'short hair' },
]);
const PORTRAIT_EYE_COLOR_PATTERN = /\b((?:(?:pale|light|dark|deep|bright|icy|soft|warm|vivid)\s+)?(?:hazel|amber|brown|blue|green|gray|grey|silver|silvery|gold|golden|violet|purple|red|black))\s+eyes?\b/i;
const PORTRAIT_DIRECT_VISUAL_ANCHORS = Object.freeze([
    { pattern: /\bpointed ears?\b/i, tag: 'pointed ears' },
    { pattern: /\bordinary human ears?\b/i, tag: 'ordinary human ears' },
    { pattern: /\bhair ribbons?\b/i, tag: 'hair ribbons' },
    { pattern: /\b(?:ample|full|large)\s+bust\b/i, sourceTag: true },
    { pattern: /\b(?:slim|slender|athletic|muscular|stocky|curvy)\s+(?:figure|build)\b/i, sourceTag: true },
]);

function sourcePhrase(match) {
    return String(match?.[0] || '').replace(/\s+/g, ' ').trim();
}

function compoundHairColorTag(context) {
    const words = '(?:auburn|ginger|crimson|red|black|brunette|brown|blond|blonde|platinum|ivory|white|silver|silvery|gray|grey|gold|golden|cobalt|azure|indigo|blue|violet|purple|pink|emerald|green|orange)';
    const pattern = new RegExp('\\b(' + words + '(?:\\s*(?:-|and|\\/)\\s*' + words + ')+)\\s+(?:hair|curls?|locks?|braids?|tresses?)\\b', 'i');
    const match = String(context || '').match(pattern);
    if (!match) return '';
    return match[1].replace(/\s*(?:-|and|\/)\s*/gi, '-').toLowerCase() + ' hair';
}

export function extractPortraitVisualAnchorTags(value) {
    const source = cleanText(value, 1800);
    if (!source) return [];
    const tags = [];
    const segments = source.split(/[;\n]+|\.(?:\s+|$)|,/).map(item => item.trim()).filter(Boolean);

    for (const segment of segments) {
        if (/\b(?:hair|curls?|locks?|braids?|tresses?)\b/i.test(segment)) {
            const compound = compoundHairColorTag(segment);
            if (compound) tags.push(compound);
            else {
                for (const rule of PORTRAIT_HAIR_COLOR_SURFACE_RULES) {
                    if (rule.pattern.test(segment)) tags.push(rule.tag);
                }
            }
            for (const rule of PORTRAIT_HAIR_FORM_RULES) {
                if (rule.pattern.test(segment)) tags.push(rule.tag);
            }
        }

        const eye = segment.match(PORTRAIT_EYE_COLOR_PATTERN);
        if (eye) tags.push(eye[1].replace(/\s+/g, ' ').trim().toLowerCase() + ' eyes');

        for (const rule of PORTRAIT_DIRECT_VISUAL_ANCHORS) {
            const match = segment.match(rule.pattern);
            if (match) tags.push(rule.sourceTag ? sourcePhrase(match).toLowerCase() : rule.tag);
        }
    }

    return uniquePortraitParts(tags);
}


export function portraitTagFallbackParts(values = []) {
    const fallback = [];
    for (const value of values) {
        const segments = String(value || '')
            .split(/,/)
            .map(item => item.replace(/^\s*(?:and|with)\s+/i, '').trim())
            .filter(Boolean);
        for (const segment of segments) {
            if (extractPortraitVisualAnchorTags(segment).length) continue;
            fallback.push(segment);
        }
    }
    return uniquePortraitParts(fallback);
}
