import { createSendPending } from '../../src/v2/ui-host/send-pending.js';
import { installDom } from './view/widgets/fake-dom.js';
import { createSendNote } from '../../src/v2/ui-host/send-note.js';

// A tiny fake clock: timers fire in due order when advance() moves time forward.
export function fakeClock() {
    let now = 0, nextId = 1;
    const timers = new Map();
    return {
        timers: {
            setTimeout(fn, ms) { const id = nextId++; timers.set(id, { at: now + ms, fn }); return id; },
            clearTimeout(id) { timers.delete(id); },
        },
        advance(ms) {
            const end = now + ms;
            for (;;) {
                let due = null;
                for (const [id, t] of timers) if (t.at <= end && (!due || t.at < due.at || (t.at === due.at && id < due.id))) due = { id, at: t.at, fn: t.fn };
                if (!due) break;
                now = due.at; timers.delete(due.id); due.fn();
            }
            now = end;
        },
        pending: () => timers.size,
    };
}

// Builds the machine around a fake page: `box` is the typed text, `busy` and `held` are switches the test flips.
export function rig(opts = {}) {
    const clock = fakeClock();
    const page = { box: 'I knock on the cabin door and wait.', busy: false, held: false, sends: [], boardOpens: 0, changes: [] };
    const sp = createSendPending({
        readText: () => page.box,
        clickSend: () => page.sends.push(page.box),
        isBusy: () => page.busy,
        interactionHeld: () => page.held,
        openHeld: () => { page.boardOpens++; return true; },
        onChange: (s) => page.changes.push(s.state),
        timers: clock.timers,
        ...opts,
    });
    return { sp, clock, page };
}

export function pageRig(opts = {}) {
    const doc = installDom();
    const proto = Object.getPrototypeOf(doc.createElement('div'));
    proto.closest = function (sel) { const id = sel.replace('#', ''); for (let n = this; n; n = n.parentNode) if (n.id === id) return n; return null; };
    if (!Object.getOwnPropertyDescriptor(proto, 'nextElementSibling')) Object.defineProperty(proto, 'nextElementSibling', { get() { const l = this.parentNode?.children ?? []; return l[l.indexOf(this) + 1] ?? null; }, configurable: true });
    doc.getElementById = id => doc.body.querySelector(`#${id}`);
    doc.defaultView = { addEventListener: (t, f, o) => doc.addEventListener(t, f, o), removeEventListener: (t, f, o) => doc.removeEventListener(t, f, o) };
    const form = doc.createElement('div'); form.setAttribute('id', 'send_form');
    const box = doc.createElement('textarea'); box.setAttribute('id', 'send_textarea'); box.value = 'I knock on the cabin door and wait.';
    const send = doc.createElement('button'); send.setAttribute('id', 'send_but');
    const stop = doc.createElement('div'); stop.setAttribute('id', 'mes_stop'); stop.style = { display: 'none' };
    form.append(box, send); doc.body.append(form, stop);
    const page = { clicks: 0, busy: false, held: false, boards: 0, on: true, handlers: [], ignore: true };
    // SillyTavern's Send: takes the text (clears the box and says "input") unless told to ignore it.
    // A programmatic click travels the document's listeners like a real one (the note's own re-send must not count as a new press).
    send.click = () => { doc.fire('click', {}, send); };
    send.addEventListener('click', () => { page.clicks++; if (!page.ignore) { page.handlers.forEach(fn => fn('normal', {}, false)); box.value = ''; doc.fire('input', {}, box); } });
    const clock = fakeClock();
    const ctx = { eventTypes: { GENERATION_STARTED: 'gs', GENERATION_AFTER_COMMANDS: 'gac' }, eventSource: { on: (n, f) => page.handlers.push(f), removeListener: () => {} } };
    const note = createSendNote({ doc, ctx, enabled: () => page.on, busy: () => page.busy, held: () => page.held, openHeld: () => { page.boards++; return true; }, timers: clock.timers, ...opts });
    const press = () => doc.fire('click', {}, send);
    const pill = () => doc.body.querySelector('.ss-send-note-pill');
    return { doc, page, note, clock, press, pill, box, form, send, stop };
}
