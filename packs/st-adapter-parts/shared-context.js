// The job: reaching SillyTavern's context, read when called (shared by every st-adapter part).

export const context = () => globalThis.SillyTavern?.getContext?.() ?? null;
