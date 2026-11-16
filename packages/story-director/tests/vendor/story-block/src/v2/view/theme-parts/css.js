// Story Suite v2: the theme sheet text for a scheme, panel style, font, glass strength and text size.

import { ROOT_SELECTOR } from './roots.js';
import { SCHEMES } from './options.js';
import { DEFAULT_PANEL, DEFAULT_FONT, DEFAULT_GLASS, DEFAULT_TEXT_SIZE } from './defaults.js';
import { TEXT_SIZES, textSizeOf } from './text-size.js';
import { SHEET_RESET } from './sheet-tokens.js';
import { themeChoice } from './scheme-choice.js';
import { schemeTokens } from './scheme-tokens.js';
import { themeTokens } from './tokens.js';

const block = (selector, tokens, indent = '') => `${indent}${selector} {\n${tokens.map(([name, value]) => `${indent}    ${name}: ${value};`).join('\n')}\n${indent}}`;
const forced = scheme => `${ROOT_SELECTOR}:where(.ss-scheme-${scheme}), ${ROOT_SELECTOR} :where(.ss-scheme-${scheme})`;

/**
 * The theme sheet for `{ scheme, panel, font }`: the tokens on every Story Suite root, the two forced
 * schemes (classes `ss-scheme-light`, `ss-scheme-dark`), Solid's opaque glass where relative colours work, Solid in place of Glass
 * for a system that asks for less transparency, and no transitions for one that asks for less motion.
 */
export function themeCss({ scheme = 'dark', panel = DEFAULT_PANEL, font = DEFAULT_FONT, strength = DEFAULT_GLASS, textSize = DEFAULT_TEXT_SIZE } = {}) {
    const choice = { scheme: SCHEMES.includes(scheme) ? scheme : 'dark', ...themeChoice({ panelStyle: panel, font, glassStrength: strength }) };
    const out = [`/* Story Suite theme (src/v2/view/theme.js): ${choice.panel}, ${choice.panel === 'sillytavern' ? 'as SillyTavern' : choice.scheme}, ${choice.font}${choice.panel === 'glass' ? `, glass ${choice.strength}%` : ''}. */`];
    out.push(block(ROOT_SELECTOR, themeTokens(choice)));
    if (choice.panel !== 'sillytavern') {
        for (const s of SCHEMES) out.push(block(forced(s), [['--ss-scheme', s], ...schemeTokens(s, choice.panel, choice)]));
    }
    // Glass takes SillyTavern's tint into its colour (never its alpha) where relative colours work.
    const glassOnly = tokens => tokens.filter(([name]) => /^--ss-glass/.test(name));
    if (choice.panel === 'glass') {
        const tinted = [
            block(ROOT_SELECTOR, glassOnly(schemeTokens(choice.scheme, 'glass', { strength: choice.strength, tinted: true })), '    '),
            ...SCHEMES.map(s => block(forced(s), glassOnly(schemeTokens(s, 'glass', { strength: choice.strength, tinted: true })), '    ')),
        ];
        out.push(`@supports (color: rgb(from red r g b)) {\n${tinted.join('\n')}\n}`);
    }
    // `reset`: the legacy surfaces go back to SillyTavern's tint (Glass under "reduce transparency" is Solid).
    const solidBlocks = (indent, opaque, reset = []) => [
        block(ROOT_SELECTOR, [...schemeTokens(choice.scheme, 'solid', { opaque }).filter(([name]) => /glass|overlay|blur/.test(name)), ...reset], indent),
        ...SCHEMES.map(s => block(forced(s), schemeTokens(s, 'solid', { opaque }).filter(([name]) => /glass|overlay|blur/.test(name)), indent)),
    ];
    if (choice.panel === 'solid') out.push(`@supports (color: rgb(from red r g b)) {\n${solidBlocks('    ', true).join('\n')}\n}`);
    if (choice.panel === 'glass') {
        out.push(`@media (prefers-reduced-transparency: reduce) {\n${solidBlocks('    ', false, SHEET_RESET).join('\n')}\n}`);
        out.push(`@media (prefers-reduced-transparency: reduce) {\n    @supports (color: rgb(from red r g b)) {\n${solidBlocks('        ', true, SHEET_RESET).join('\n')}\n    }\n}`);
    }
    out.push(`@media (prefers-reduced-motion: reduce) {\n${block(ROOT_SELECTOR, [['--ss-motion', '0s']], '    ')}\n}`);
    // Text size (not Normal): the size every root is zoomed to. `html:root` outranks size.css's `:root` whatever the order.
    const zoom = TEXT_SIZES[textSizeOf({ textSize })];
    if (zoom) out.push(`/* Text size ${textSizeOf({ textSize })}% */\n${block('html:root', [['--ss-zoom', String(zoom)]])}`);
    return `${out.join('\n')}\n`;
}
