// The first send of a chat with the RPG on and no You, in the new view: the Send (button or Enter) is held and the sheet "Make your character
// first" opens, with the old dialog's words and rules. "Send without the RPG for now" sends it with
// no dice and never asks again in this chat; "Create your character, then send" opens the new wizard and sends when Create made the character
// (cancelled: the text is back in the box). Closing the sheet puts the text back. What the chat remembers is the same chat metadata
// (modules/rpg/start.js). This one listens in the window's capture phase, before any listener on the document.

import { h } from '../kit/dom.js';
import { button } from '../kit/controls.js';
import { openSheet } from '../kit/sheet.js';
import { setStartNotes, startNotes } from '../../modules/rpg/start.js';
import { RPG_STRINGS } from '../../modules/rpg/strings.js';

const S = RPG_STRINGS.start;
const QUOTE_MAX = 280;
const cut = (text, max) => { const chars = [...text]; return chars.length > max ? `${chars.slice(0, max).join('').trimEnd()}…` : text; };

/**
 * `createSendHold({ doc, ctx, world, wizard, suite, sheetCtx })`: `ctx()` SillyTavern's live context (chat metadata, its save, shouldSendOnEnter);
 * `world` ui/wizard/world.js's; `wizard` ui/wizard/wizard.js's; `suite` the mounted view ({ open, close, isOpen }: the sheet shows inside it).
 * → { attach(), detach(), close(), show(text), session() }.
 */
export function createSendHold({ doc, ctx = () => null, world, wizard, suite, sheetCtx = () => ({}) }) {
  let hold = null, bypass = false, attached = false;
  const win = typeof doc?.defaultView?.addEventListener === 'function' ? doc.defaultView : doc;
  const meta = () => { try { return ctx()?.chatMetadata ?? null; } catch { return null; } };
  const notes = () => { try { return startNotes(meta()); } catch { return startNotes(null); } };
  const remember = patch => { try { const c = ctx(); if (setStartNotes(meta(), patch)) (c?.saveMetadata ?? c?.saveMetadataDebounced)?.call(c); } catch { /* the choice lasts this page only */ } };
  const box = () => doc.getElementById?.('send_textarea') ?? null;
  const generating = () => {
    const stop = doc.getElementById?.('mes_stop');
    if (!stop) return false;
    try { return (doc.defaultView?.getComputedStyle?.(stop)?.display ?? 'none') !== 'none'; } catch { return false; }
  };
  const restore = text => { const field = box(); if (field && !String(field.value ?? '').trim()) { field.value = text; field.dispatchEvent?.(new (doc.defaultView?.Event ?? globalThis.Event)('input', { bubbles: true })); } };
  const sendAgain = () => { const send = doc.getElementById?.('send_but'); if (!send) return; bypass = true; try { send.click(); } finally { bypass = false; } };
  // A touch screen keeps its focus where the suite gave it back (focusing the box there would bring up the keyboard).
  const touch = () => { try { return doc.defaultView?.matchMedia?.('(pointer: coarse)')?.matches === true; } catch { return false; } };
  // The suite opened for the sheet is closed again when the choice is made, so the reader is back at the chat, typing in the box.
  const leave = own => { if (own.openedSuite) { own.openedSuite = false; suite?.close?.(); if (!touch()) box()?.focus?.({ preventScroll: true }); } };

  // A story that already has a character, but none named like the persona (the persona was changed): the hold says so, and does not offer a second character.
  const mismatch = () => {
    try {
      const persona = world.readerName?.() ?? '';
      const names = (world.world?.().names ?? []).filter(Boolean);
      return persona && names.length ? { persona, names: names.join(' and ') } : null;
    } catch { return null; }
  };

  function openHold(text) {
    if (hold) return;
    const clash = mismatch();
    const own = { text, decided: false, sheet: null, openedSuite: false };
    hold = own;
    if (!suite?.isOpen?.()) own.openedSuite = Boolean(suite?.open?.());
    const sheet = openSheet(sheetCtx() ?? {}, { title: S.holdTitle, id: 'rpg-hold', onClose: () => {
      if (hold === own) hold = null;
      if (!own.decided) { restore(own.text); leave(own); }
    } });
    own.sheet = sheet;
    sheet.el.classList.add('wz-hold');
    const decide = () => { own.decided = true; sheet.close(); };
    sheet.body.append(
      h('p', { class: 'ps-p', dataset: clash ? { hold: 'mismatch' } : {} }, clash ? S.holdMismatch.replaceAll('{names}', () => clash.names).replace('{persona}', () => clash.persona) : S.holdText),
      h('blockquote', { class: 'wz-quote', 'aria-label': S.holdLabel }, cut(text, QUOTE_MAX)),
      h('div', { class: 'ps-row wz-hold-acts' },
        button({ label: S.holdWithout, dataset: { hold: 'without' }, onClick: () => {
          // Asked once: never again in this chat; the next reply is sent with no dice.
          remember({ asked: true, skip: true });
          decide();
          leave(own);
          sendAgain();
        } }),
        clash ? null : button({ label: S.holdCreate, tone: 'primary', dataset: { hold: 'create' }, onClick: () => {
          decide();
          const opened = wizard.open(null, { onEnd: created => { leave(own); if (created) sendAgain(); else restore(own.text); } });
          if (!opened) { leave(own); restore(own.text); }
        } })));
  }

  // The first Send of a chat with no You: held. `kind` is 'click' or 'enter'; true when it was held.
  function intercept(event, kind) {
    if (bypass) return false;
    if (kind === 'click' && !event.target?.closest?.('#send_but')) return false;
    if (!world.rpgOn()) return false;
    const text = String(box()?.value ?? '');
    if (!text.trim() || text.trim().startsWith('/')) return false;
    if (notes().asked || world.hasYou() || generating()) return false;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    event.stopPropagation?.();
    openHold(text);
    return true;
  }
  const onClick = event => { intercept(event, 'click'); };
  const onKey = event => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.isComposing) return;
    if (doc.activeElement !== box()) return;
    // SillyTavern sends on Enter only when its setting says so; otherwise Enter is a line break and nothing is held.
    let sends = true;
    try { sends = ctx()?.shouldSendOnEnter?.() !== false; } catch { sends = true; }
    if (sends) intercept(event, 'enter');
  };

  return {
    attach() { if (attached) return; attached = true; win.addEventListener?.('click', onClick, true); win.addEventListener?.('keydown', onKey, true); },
    detach() { if (!attached) return; attached = false; win.removeEventListener?.('click', onClick, true); win.removeEventListener?.('keydown', onKey, true); hold?.sheet?.close(); },
    close: () => { hold?.sheet?.close(); },
    // (the sheet for `text` without a Send: the dev harness draws it so)
    show: text => openHold(String(text ?? '')),
    session: () => hold,
  };
}
