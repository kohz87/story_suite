// The portrait theme presets and the custom-preset limits: the fixed style table every portrait setting is read against.

import { DEFAULT_PORTRAIT_STYLE_POSITIVE, DEFAULT_PORTRAIT_STYLE_NEGATIVE } from '../core.js';

export const PORTRAIT_THEME_PRESETS = Object.freeze({
    fantasy_anime: {
        label: 'Fantasy Anime',
        positive: DEFAULT_PORTRAIT_STYLE_POSITIVE,
        negative: DEFAULT_PORTRAIT_STYLE_NEGATIVE,
    },
    anime_key_visual: {
        label: 'Anime Key Visual',
        positive: 'high-end fantasy anime key visual, crisp expressive linework, polished cel shading, luminous detailed eyes, elegant costume rendering, cinematic color design, studio-quality character illustration',
        negative: DEFAULT_PORTRAIT_STYLE_NEGATIVE,
    },
    painterly_fantasy: {
        label: 'Painterly Fantasy',
        positive: 'painterly fantasy character portrait, refined brushwork, detailed face and eyes, rich textile rendering, atmospheric cinematic light, elegant high-fantasy illustration',
        negative: 'low quality, blurry, bad anatomy, malformed hands, extra limbs, duplicate character, text, watermark, logo, flat cel shading, cheap 3d render',
    },
    dark_medieval: {
        label: 'Dark Medieval',
        positive: 'grounded dark medieval fantasy character portrait, weathered materials, restrained dramatic lighting, detailed practical clothing and armor, serious illustrated realism',
        negative: 'low quality, blurry, bad anatomy, extra limbs, duplicate character, text, watermark, logo, neon cyberpunk, modern streetwear, glossy plastic armor',
    },
    semi_realistic: {
        label: 'Semi-Realistic',
        positive: 'semi-realistic fantasy character portrait, natural facial anatomy, detailed eyes and hair, realistic fabric and metal textures, soft cinematic lighting, polished digital illustration',
        negative: 'low quality, blurry, bad anatomy, malformed hands, extra limbs, duplicate character, text, watermark, logo, chibi, super-deformed proportions, cheap 3d render',
    },
    custom: { label: 'Custom Library', positive: '', negative: '' },
});

export const PORTRAIT_CUSTOM_PRESET_LIMIT = 24;
export const DEFAULT_CUSTOM_PORTRAIT_PRESET_ID = 'custom-default';
