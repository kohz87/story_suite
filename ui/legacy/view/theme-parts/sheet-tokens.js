// Story Suite v2: the tokens the legacy surfaces paint under Glass, and their reset.

// What the legacy surfaces paint under Glass: the dense glass, its blur and no extra layers (the game view's opaque fallback).
// The shape of the glass for the frames that were opaque (the HUD strip, the dialog mount): their radius, edge and shadow.
// Set for Glass only, so Solid and Follow SillyTavern keep those frames' own shape (the frames read each with a fallback).
export const SHEET_TOKENS = Object.freeze([
    ['--ss-sheet-bg', 'var(--ss-glass-strong)'], ['--ss-sheet-blur', 'var(--ss-blur)'], ['--ss-sheet-layers', 'none'],
    // the same tint with its alpha dropped: the floor under the translucent sheet, so the story behind cannot be read through it
    // on a phone with blur off (mounts-*.css stacks the tint over this floor). Relative colours; without them the floor is unset.
    ['--ss-sheet-floor', 'rgb(from var(--ss-glass-strong) r g b / 1)'],
    // the phone game view's floor and its three layers of the tint, Glass only (mounts-*.css, the phone rule); unset for the other styles
    ['--ss-gameview-phone-floor', 'var(--ss-sheet-floor)'],
    ['--ss-gameview-phone-layers', 'linear-gradient(var(--ss-sheet-bg), var(--ss-sheet-bg)), linear-gradient(var(--ss-sheet-bg), var(--ss-sheet-bg)), linear-gradient(var(--ss-sheet-bg), var(--ss-sheet-bg))'],
    ['--ss-sheet-radius', 'var(--ss-radius-l)'], ['--ss-sheet-radius-top', 'var(--ss-radius-l) var(--ss-radius-l) 0 0'],
    ['--ss-sheet-edge', '1px solid var(--ss-border)'], ['--ss-sheet-shadow', 'var(--ss-shadow)'],
    // the HUD strip on a phone: the Glass tint three times over (the same compounding as the full-screen window), Glass only
    ['--ss-sheet-hud-layers', 'linear-gradient(var(--ss-sheet-bg), var(--ss-sheet-bg)), linear-gradient(var(--ss-sheet-bg), var(--ss-sheet-bg)), linear-gradient(var(--ss-sheet-bg), var(--ss-sheet-bg))'],
]);
export const SHEET_RESET = Object.freeze(SHEET_TOKENS.map(([name]) => [name, 'initial']));
