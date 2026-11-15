// SillyTavern's context, read when called (never at import), shared by the adapter's two files.

export const context = () => globalThis.SillyTavern?.getContext?.() ?? null;
