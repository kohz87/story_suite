// The start pieces: Home's "Your character" card and the hold on a chat's first send.

import { h, shell } from '../../../../../../../ui/legacy/view/widgets/dom.js';
import { setStartNotes, startNotes } from '../../start.js';
import { RPG_STRINGS } from '../../strings.js';
import { readParty } from '../party-data.js';
import { HOLD_SCREEN_ID, createHoldScreen } from './hold-screen.js';

const S = RPG_STRINGS.start;

// How much of the held message the dialog quotes (the whole of it stays in the message box).
const QUOTE_MAX = 280;
const cut = (text, max) => { const chars = [...text]; return chars.length > max ? `${chars.slice(0, max).join('').trimEnd()}…` : text; };

/**
 * The start pieces. `deps`: `doc`, `headState()`, `readerName()`, `featureOn()`, `roleOf(definition)`, `openDialog(id, { draft, onClose })`,
 * `wizard` (view/wizard.js createWizard: `open(prefill, { onEnd })`), `meta()` (the open chat's metadata object, or null),
 * `save()` (writes the chat's metadata), `redraw()` (draws Home again).
 * → { widget, holdWidget, holdScreen, attach(), detach(), hasYou(), session() }.
 */
export function createStart({ doc, headState = () => null, readerName = () => '', featureOn = () => true, roleOf, openDialog = null, wizard = null, meta = () => null, save = () => {}, redraw = () => {} } = {}) {
    let hold = null, bypass = false, attached = false;
    const live = new Set();
    const tell = () => { for (const draw of [...live]) draw(); try { redraw(); } catch { /* Home draws itself again on the next change */ } };
    const notes = () => { try { return startNotes(meta()); } catch { return startNotes(null); } };
    const remember = patch => { try { if (setStartNotes(meta(), patch)) save(); } catch { /* the choice lasts this page only */ } };

    // Whether the story has a character for the reader: one named like their persona (the Party tab's "you"). With no persona name known any
    // character at all counts, since nobody can be told apart.
    const hasYou = () => {
        const name = String(readerName() ?? '').replace(/\s+/g, ' ').trim();
        const party = readParty(headState(), { own: name, roleOf });
        return name ? party.some(character => character.own) : party.length > 0;
    };
    const create = () => { try { wizard?.open(); } catch { /* the dialog may not open here */ } };

    // ---- Home's card ----
    const widget = {
        props: {}, primary: null, validate: () => [],
        render: (el, _props, _api) => shell(el, 'section', 'rpg-start-host', ({ doc: d, root }) => {
            const draw = () => {
                root.replaceChildren();
                const show = featureOn() && !hasYou() && !notes().hidden;
                el.hidden = !show;
                if (!show) return;
                const card = h(d, 'section', 'panel rpg-start');
                card.setAttribute('aria-label', S.homeTitle);
                const head = h(d, 'h4', 'ss-section-label');
                const icon = h(d, 'i', 'fa-solid fa-user-plus');
                icon.setAttribute('aria-hidden', 'true');
                head.append(icon, d.createTextNode(` ${S.homeTitle}`));
                const actions = h(d, 'div', 'rpg-start-actions');
                const make = h(d, 'button', 'ss-button ss-button-primary rpg-start-create', S.homeCreate);
                make.setAttribute('type', 'button');
                make.addEventListener('click', create);
                const later = h(d, 'button', 'ss-button rpg-start-later', S.homeNotNow);
                later.setAttribute('type', 'button');
                later.addEventListener('click', () => { remember({ hidden: true }); tell(); });
                actions.append(make, later);
                card.append(head, h(d, 'p', 'rpg-start-text', S.homeText), actions);
                root.appendChild(card);
            };
            live.add(draw);
            draw();
            return { update() { draw(); }, destroy() { live.delete(draw); root.replaceChildren(); } };
        }),
    };

    // ---- the first send ----
    const box = () => doc.getElementById?.('send_textarea') ?? null;
    const sendButton = () => doc.getElementById?.('send_but') ?? null;
    // A generation is running (SillyTavern shows its Stop button): the Send button does not send then, so nothing is held.
    const generating = () => {
        const stop = doc.getElementById?.('mes_stop');
        if (!stop) return false;
        try { return (doc.defaultView?.getComputedStyle?.(stop)?.display ?? 'none') !== 'none'; } catch { return false; }
    };
    const restore = text => { const field = box(); if (field && !String(field.value ?? '').trim()) { field.value = text; field.dispatchEvent?.(new (doc.defaultView?.Event ?? globalThis.Event)('input', { bubbles: true })); } };
    const sendAgain = () => {
        const button = sendButton();
        if (!button) return;
        bypass = true;
        try { button.click(); } finally { bypass = false; }
    };
    const closeHold = decided => { if (hold) { hold.decided = decided; try { hold.handle?.close?.(); } catch { /* already closed */ } } };

    function openHold(text) {
        if (hold?.handle?.isOpen?.()) return;
        if (typeof openDialog !== 'function') return;
        const own = { text, handle: null, decided: false };
        hold = own;
        const handle = openDialog(HOLD_SCREEN_ID, { draft: {}, onClose: () => {
            if (hold === own) hold = null;
            // Closed without choosing (the window's own close, Escape, a chat change): the text is back in the message box.
            if (!own.decided) restore(own.text);
        } });
        if (!handle) { hold = null; return; }
        own.handle = handle;
    }

    // The first Send of a chat with no character: held. `kind` is 'click' or 'enter'; true when the send was held.
    function intercept(event, kind) {
        if (bypass) return false;
        if (kind === 'click' && !event.target?.closest?.('#send_but')) return false;
        if (!featureOn()) return false;
        const field = box();
        const text = String(field?.value ?? '');
        if (!text.trim() || text.trim().startsWith('/')) return false;
        if (notes().asked || hasYou() || generating()) return false;
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
        try { sends = globalThis.SillyTavern?.getContext?.()?.shouldSendOnEnter?.() !== false; } catch { sends = true; }
        if (sends) intercept(event, 'enter');
    };

    /** Starts listening for the Send button and Enter (capture phase, so it comes before SillyTavern's own handlers). */
    function attach() {
        if (attached) return;
        attached = true;
        doc.addEventListener?.('click', onClick, true);
        doc.addEventListener?.('keydown', onKey, true);
    }
    function detach() {
        if (!attached) return;
        attached = false;
        doc.removeEventListener?.('click', onClick, true);
        doc.removeEventListener?.('keydown', onKey, true);
        closeHold(true);
    }

    // The dialog's body.
    const holdWidget = {
        props: {}, primary: null, validate: () => [],
        render: (el, _props, _api) => shell(el, 'section', 'rpg-hold', ({ doc: d, root }) => {
            root.appendChild(h(d, 'p', 'rpg-hold-text', S.holdText));
            const quote = h(d, 'blockquote', 'rpg-hold-quote', cut(hold?.text ?? '', QUOTE_MAX));
            quote.setAttribute('aria-label', S.holdLabel);
            root.appendChild(quote);
            const actions = h(d, 'div', 'rpg-hold-actions');
            const without = h(d, 'button', 'ss-button rpg-hold-without', S.holdWithout);
            without.setAttribute('type', 'button');
            without.addEventListener('click', () => {
                const text = hold?.text;
                if (text === undefined) return;
                // Asked once: never again in this chat. The next reply is sent with no dice.
                remember({ asked: true, skip: true });
                closeHold(true);
                tell();
                sendAgain();
            });
            const make = h(d, 'button', 'ss-button ss-button-primary rpg-hold-create', S.holdCreate);
            make.setAttribute('type', 'button');
            make.addEventListener('click', () => {
                const text = hold?.text;
                if (text === undefined) return;
                closeHold(true);
                // The wizard sends the message when Create succeeds; cancelled, the text is back in the box.
                const opened = wizard?.open(null, { onEnd: created => { if (created) sendAgain(); else restore(text); } });
                if (!opened) restore(text);
            });
            actions.append(without, make);
            root.appendChild(actions);
            return { update() {}, destroy() {} };
        }),
    };

    return { widget, holdWidget, holdScreen: createHoldScreen(), attach, detach, hasYou, session: () => hold };
}
