// Story Suite v2: every token for a choice: the scheme's colours, the shared sizes and colours, and the font.

import { schemeTokens } from './scheme-tokens.js';
import { SHARED } from './palettes.js';
import { FONT_STACKS } from './fonts.js';
import { DEFAULT_PANEL, DEFAULT_FONT, DEFAULT_GLASS } from './defaults.js';

/** Every token for a choice: the scheme's colours, then the shared sizes, colours and the font. */
export function themeTokens({ scheme = 'dark', panel = DEFAULT_PANEL, font = DEFAULT_FONT, strength = DEFAULT_GLASS } = {}) {
    return [
        ['--ss-scheme', panel === 'sillytavern' ? 'sillytavern' : scheme],
        ...schemeTokens(scheme, panel, { strength }),
        ...Object.entries(SHARED),
        ['--ss-font', FONT_STACKS[font] ?? FONT_STACKS.nunito],
    ];
}
