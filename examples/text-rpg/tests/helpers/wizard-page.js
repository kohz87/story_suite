// A fake page for the New character wizard's tests: the plug-in screen's sheet (overlay > panel > body) on the shared fake DOM, the wizard drawn into the body, and small drivers.
import { installFakeDom } from '../../../../tests/helpers/ui-fake-dom.js';
import { renderNewCharacter } from '../../src/widget/new-character.js';

/** `{ doc, overlay, body, cleanup, closed(), q(sel), all(sel), type(sel, value), press(sel) }`; `command` is the api's, `more` the rest of it (a `query`). */
export function wizardPage(command = async () => ({ ok: true }), more = {}) {
    const doc = installFakeDom();
    const overlay = doc.createElement('div');
    overlay.className = 'sh-ov';
    const panel = doc.createElement('div');
    const body = doc.createElement('div');
    panel.appendChild(body);
    overlay.appendChild(panel);
    doc.body.appendChild(overlay);
    let closes = 0;
    const cleanup = renderNewCharacter(body, {}, { ...more, command, close: () => { closes += 1; } });
    const q = selector => body.querySelector(selector);
    return {
        doc, overlay, body, cleanup, q,
        closed: () => closes,
        all: selector => body.querySelectorAll(selector),
        type(selector, value) { const node = q(selector); node.value = String(value); node.dispatchEvent(new globalThis.Event('input')); node.dispatchEvent(new globalThis.Event('change')); },
        press(selector) { if (q(selector).hasAttribute('disabled')) return; q(selector).dispatchEvent(new globalThis.Event('click')); },
    };
}
