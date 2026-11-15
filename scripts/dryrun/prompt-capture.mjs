// Drives the host's own prompt build for the next reply, the way a generate does (the interceptor sets the two
// prompt slots), and returns the static text and the tail it would send.
const CONTEXT_SIZE = 8192;
const RETRIES = 40;
const RETRY_MS = 250;

function staticSlots(host) {
  const prompts = host.st?.prompts?.() ?? {};
  const out = {};
  for (const key of Object.keys(prompts).sort()) {
    if (key.startsWith('story_suite_static')) out[key] = String(prompts[key]?.value ?? '');
  }
  return out;
}

function tailSlots(host) {
  const prompts = host.st?.prompts?.() ?? {};
  const out = {};
  for (const key of Object.keys(prompts).sort()) {
    if (key.startsWith('story_suite_tail')) out[key] = String(prompts[key]?.value ?? '');
  }
  return out;
}

/**
 * Runs the interceptor on a copy of the current chat as a normal generate would, then reads the slots it set.
 * Returns `{ static, tail, parts, error }`; `error` is set when the build threw or the static text came out empty.
 */
export async function capturePrompt(host) {
  try {
    const chat = structuredClone(host.ctx.chat ?? []).filter(message => !message?.is_system);
    // A part still loading its saved records holds the reply back and retries by itself: ask again until it lets go.
    let aborted = true;
    for (let attempt = 0; attempt < RETRIES && aborted; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, RETRY_MS));
      aborted = false;
      await host.turn.interceptor(structuredClone(chat), CONTEXT_SIZE, () => { aborted = true; }, 'normal');
    }
    const staticText = staticSlots(host);
    const total = Object.values(staticText).reduce((sum, text) => sum + text.length, 0);
    const parts = (host.turn.preview?.() ?? [])
      .filter(part => part?.place === 'tail')
      .map(part => ({ module: part.module ?? null, label: part.label ?? null, text: part.text ?? '' }));
    const error = aborted ? 'the interceptor stopped the generation' : total === 0 ? 'static prompt text is empty' : null;
    return { static: staticText, tail: tailSlots(host), parts, error };
  } catch (err) {
    return { static: {}, tail: {}, parts: [], error: `prompt build threw: ${String(err?.message ?? err)}` };
  }
}
