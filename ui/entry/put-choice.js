// A choice's words go into SillyTavern's message box, as if typed (its input event lets SillyTavern size the box).
// A choice adds to what the box already holds, on its own line, so several choices can be sent together; the same choice twice is not added again (owner, 20 Nov).

/** Adds `text` to the page's #send_textarea on a new line (or fills it when empty) and focuses it. */
export function putChoice(doc, text) {
  const box = doc.querySelector('#send_textarea');
  if (!box) return;
  const had = String(box.value ?? '').replace(/\s+$/, '');
  if (!had.split('\n').includes(text)) {
    box.value = had ? `${had}\n${text}` : text;
    box.dispatchEvent?.(new (doc.defaultView?.Event ?? globalThis.Event)('input', { bubbles: true }));
  }
  box.focus?.();
}
