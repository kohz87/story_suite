// The UI bucket defaults. `next` is the old preview switch's key: nothing reads it since the new view became the default (the old
// view is a per-device fallback, ui/entry/flag.js); it stays so the pinned settings defaults do not change until the old view is removed.

/** Defaults for extension_settings.storySuite.ui. */
export const UI_DEFAULTS = Object.freeze({ next: false });
