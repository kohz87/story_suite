// The live mount for the New character wizard's tests: the RPG's live parts on (modules/rpg/live) and the new view mounted by ui/entry/turn-on.js, on a testkit chat with no character. A page path is played by
// hand: the window's capture listeners, then the document's, then the target's own (SillyTavern's Send listener).
import { page, begin, settle } from '../../modules/rpg/view/page.js';
import { turnOn } from '../../../ui/entry/turn-on.js';

export { settle };

export async function settleLong() { for (let n = 0; n < 6; n += 1) await settle(); }

/** `{ doc, host, rpg(), win, field, sent, commands, press(), enter(), sheet(), hold() }`; `chat: false` leaves the chat with no message; `commands` lists what the new view sent the engine. */
export async function wizardPage(t, { persona = 'Wessel', chat = true, feature = true } = {}) {
  const got = await page(t, { formula: 'standard', persona, feature });
  const { doc, host } = got;
  doc.dispatchEvent = event => { for (const entry of [...doc.listeners]) if (entry.type === event.type) entry.fn(event); return true; };
  doc.head ??= doc.createElement('head');
  doc.getElementById = id => doc.querySelector(`#${id}`);
  for (const id of ['extensions_settings2', 'extensionsMenu', 'chat']) { const el = doc.createElement('div'); el.id = id; doc.body.appendChild(el); }
  const field = doc.createElement('textarea'); field.id = 'send_textarea'; field.value = '';
  const send = doc.createElement('div'); send.id = 'send_but';
  doc.body.append(field, send);
  const sent = [];
  send.addEventListener('click', () => { sent.push(field.value); field.value = ''; });
  const win = { ...doc.defaultView, listeners: [],
    addEventListener(type, fn, options) { this.listeners.push({ type, fn, capture: options === true || Boolean(options?.capture) }); },
    removeEventListener(type, fn) { this.listeners = this.listeners.filter(entry => entry.type !== type || entry.fn !== fn); },
    getComputedStyle: () => ({ display: 'none' }) };
  doc.defaultView = win;
  if (chat) await begin(host);
  await settle();
  const commands = [];
  const sdk = { ...host.sdk, command: (type, payload, options) => { commands.push({ type, options }); return host.sdk.command(type, payload, options); } };
  t.after(turnOn({ doc, base: 'http://suite.test/ui/', ctx: () => host.ctx, StoryBlock: { sdk, writes: null, tools: null } }));
  // The page path of a click or a key: the window's capture listeners, the document's, then (a click) the button's own.
  const through = (type, target, init = {}) => {
    const event = { type, target, defaultPrevented: false, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, ...init };
    for (const list of [win.listeners, doc.listeners]) for (const entry of [...list]) if (entry.type === type && entry.capture && !event.stopped) entry.fn(event);
    if (!event.stopped && type === 'click') target.dispatch('click');
    return event;
  };
  // the re-send the hold makes (`#send_but`.click()) takes the same path
  send.click = () => through('click', send);
  return {
    ...got, win, field, sent, commands,
    press: () => through('click', send),
    enter: (init = {}) => { doc.activeElement = field; return through('keydown', field, { key: 'Enter', ...init }); },
    sheet: () => doc.querySelector('.sh-ov[data-sheet="new-character"]'),
    hold: () => doc.querySelector('.sh-ov[data-sheet="rpg-hold"]'),
  };
}

export const click = (root, selector) => { const node = root.querySelector(selector); if (!node) throw new Error(`no ${selector}`); node.click(); return node; };
export const buttonText = (root, text) => root.querySelectorAll('button').find(node => node.textContent === text) ?? null;
/** The Character and Skills blocks the chat has, by their `who`. */
export const party = host => Object.values(host.head().domains.dataModules?.instances ?? {}).map(item => item?.chat?.fields?.who).filter(Boolean).sort();
