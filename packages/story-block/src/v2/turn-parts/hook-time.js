// How long a canGenerate or beforeGenerate hook may take, and the limit a hook may declare for itself.

// How long a canGenerate or beforeGenerate hook may take before the reply goes on without it.
export const HOOK_TIMEOUT_MS = 2500;
// A hook may declare its own, longer limit (`fn.timeoutMs`): the RPG's roll planner (removed in 2.25.0) was the one that made a model call of up to 20 s.
export const hookTimeout = fn => (Number.isFinite(fn?.timeoutMs) && fn.timeoutMs > HOOK_TIMEOUT_MS ? fn.timeoutMs : HOOK_TIMEOUT_MS);
