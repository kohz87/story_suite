// Story Suite v2: the concept's accent, the shared tokens and the two palettes.

// The accent of the approved concept, and the parts of the look that are the same in every scheme.
export const ACCENT = '#7b6cf0';
export const SHARED = Object.freeze({
    '--ss-radius-s': '10px',
    '--ss-radius-m': '14px',
    '--ss-radius-l': '18px',
    '--ss-radius-xl': '22px',
    '--ss-radius-xxl': '26px',
    '--ss-radius-button': '12px',
    '--ss-radius-pill': '999px',
    '--ss-space-1': '4px',
    '--ss-space-2': '8px',
    '--ss-space-3': '12px',
    '--ss-space-4': '16px',
    '--ss-space-5': '24px',
    '--ss-hp': '#e5484d',
    '--ss-mp': '#4fa3ff',
    '--ss-sp': 'var(--ss-tick)',
    '--ss-exp': 'var(--ss-accent)',
    '--ss-tick': '#2fbf71',
    '--ss-uncommon': '#2fbf71',
    '--ss-rare': '#4fa3ff',
    '--ss-epic': '#b07cff',
    '--ss-legendary': '#e8b04b',
    '--ss-on-ring': '#10131a',
    '--ss-knob': '#ffffff',
    '--ss-motion': '0.2s',
});

// The concept's two palettes (uiconcept Main/Settings: the `t` token blocks). `base` is the colour of the
// glass (its alpha comes from the reader's Glass strength, glassAlphas); `solid` is the opaque base for the
// Solid panel style.
export const PALETTES = Object.freeze({
    dark: Object.freeze({
        base: [30, 33, 50], solid: '#1e2132',
        tile: 'rgba(255, 255, 255, 0.09)', border: 'rgba(255, 255, 255, 0.16)', rule: 'rgba(255, 255, 255, 0.22)', shadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
        text: '#f1f2f8', muted: '#b6bacb', track: 'rgba(255, 255, 255, 0.14)',
        pill: 'rgba(255, 255, 255, 0.14)', pillText: '#f1f2f8', badge: '#f1f2f8', badgeText: '#141720',
        field: 'rgba(0, 0, 0, 0.22)', overlay: 'rgba(24, 27, 42, 0.72)', scrim: 'rgba(8, 10, 20, 0.6)', off: 'rgba(255, 255, 255, 0.22)', accentSoft: 'rgba(123, 108, 240, 0.24)',
        good: '#72dea4', bad: '#ff6b6b', warn: '#e8b04b', info: '#4fa3ff', chatter: '#d2cbff',
        // the accent as TEXT on the glass (the bar's current label, a tile's icon): >= 4.5:1 on the dark glass (the accent itself is ~4:1)
        accentText: '#a99dff',
        // warning and error TEXT (not fills): >= 4.5:1 on the glass; the base tones (--ss-bad, --ss-warn) stay for fills and bars
        badText: '#ff8a8a', warnText: '#f5c35b',
        // the settings window's help lines (field, card and feature help, the credit): >= 4.5:1 at the 5th percentile of the busy background
        help: '#d0d4e2',
    }),
    light: Object.freeze({
        base: [255, 255, 255], solid: '#f6f5fb',
        tile: 'rgba(255, 255, 255, 0.72)', border: 'rgba(255, 255, 255, 0.9)', rule: 'rgba(35, 37, 58, 0.22)', shadow: '0 10px 30px rgba(70, 60, 130, 0.14)',
        text: '#23253a', muted: '#5b5e74', track: 'rgba(35, 37, 58, 0.1)',
        pill: '#2c2f46', pillText: '#ffffff', badge: '#2c2f46', badgeText: '#ffffff',
        field: 'rgba(255, 255, 255, 0.85)', overlay: 'rgba(255, 255, 255, 0.78)', scrim: 'rgba(35, 37, 58, 0.38)', off: 'rgba(35, 37, 58, 0.22)', accentSoft: 'rgba(123, 108, 240, 0.16)',
        good: '#1d7c4a', bad: '#b3261e', warn: '#8a5a00', info: '#1f6fd0', chatter: '#5544c4',
        // the accent as text on the light glass: >= 4.5:1
        accentText: '#5a48d6',
        // warning and error TEXT on the light glass: >= 4.5:1 (the base tones are 2.56:1 and 1.80:1 on #f6f5fb)
        badText: '#a4262c', warnText: '#8a4b00',
        help: '#23253a',
    }),
});
