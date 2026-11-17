// Coordinates the waiting reply, its pause screen and the board's send button.
// The saved choice is bound to the chat's last user message and anchor reply.

import { createPauseView } from './pause.js';
import { pauseViewData } from './start-view-data.js';
import { pendingStart } from '../../../core/interaction/start-hold.js';
import { readSheet } from '../read.js';

export function createStartController({ doc, chat, meta, state, preview, board, interaction, on, save, refresh, generate, cap = () => 3, show = () => {}, close = () => {} } = {}) {
    const listeners = new Set();
    let sending = false, error = '';
    const current = () => on() ? pendingStart(meta(), chat()) : null;
    // The Send copy the interaction api made at "Send with this fight" (gone when the choice is made again or the send fails).
    const clearSend = () => { const box = meta()?.storySuiteInteraction; if (box && typeof box === 'object') delete box.send; };
    const tell = () => { for (const draw of [...listeners]) draw(); refresh?.(); };
    const persist = () => { try { save?.(); } catch { /* kept in this page */ } };
    const begin = (auto = false) => {
        const pending = current();
        if (!pending || pending.choice) return;
        // Foes the pre-check found are made again from the recorded opening and its seed, and must match what was recorded.
        const opened = pending.opening ? preview?.() : null;
        if (pending.opening && (!opened || JSON.stringify(opened.result?.opened ?? []) !== JSON.stringify(pending.result?.opened ?? []))) {
            error = 'The sheet changed. Restore it before opening the fight, or send without a fight.'; tell(); return;
        }
        if (!board()?.open({ state: opened?.state ?? state(), ...(pending.opening ? { opening: pending.opening, result: opened.result } : {}) })) {
            error = 'The fight could not be opened. Check the party and foes.'; tell(); return;
        }
        error = '';
        pending.choice = 'board';
        // Auto-fight plays the cap's exchanges at once; the reader then sends with the fight or takes over by hand.
        if (auto === true) board()?.auto?.();
        persist(); tell();
    };
    const send = () => {
        const pending = current();
        if (!pending || sending || pending.mode === 'working') return;
        // The staged fight goes with the send or the send does not happen: it is never replaced by a new roll.
        if (pending.choice === 'board') {
            const open = interaction?.current?.(), sent = open ? interaction.send(open.id) : null;
            if (!sent?.ok) {
                error = 'The staged fight cannot be attached to this reply (its anchor reply or exchanges are missing). Discard it (Fight tab, Discard fight) and start the fight again.';
                tell(); return;
            }
        }
        if (pending.choice === 'board') persist();
        error = '';
        sending = true;
        tell();
        try {
            const running = generate?.();
            // The reply has started: close the panel so the reader sees it being written.
            try { close(); } catch { /* the panel stays open */ }
            Promise.resolve(running).finally(() => { sending = false; tell(); }).catch(() => {});
        } catch { sending = false; clearSend(); tell(); }
    };
    // "Send without a fight": the message goes out unchanged and the opening is not recorded (the narrator sets up the foes as it does without the pre-check).
    const plain = () => {
        const pending = current();
        if (!pending || pending.choice || !pending.opening) return;
        delete pending.opening; delete pending.result;
        pending.choice = 'plain';
        clearSend();
        persist(); tell();
        send();
    };
    const pause = createPauseView({ doc, onBoard: () => begin(false), onAuto: () => begin(true), onSend: plain });
    // The reader's message is already in the chat. A second Send must not append another one while it waits.
    const stopSend = event => {
        const pending = current();
        if (!pending) return;
        event.preventDefault?.(); event.stopImmediatePropagation?.(); event.stopPropagation?.();
        if (pending.choice === 'plain') { send(); return; }
        tell(); show();
    };
    // A Send held by this pause (a plain-send choice goes through): what the "Send pending" note shows and its "Open fight board" button.
    const holds = () => { const pending = current(); return Boolean(pending) && pending.choice !== 'plain'; };
    const openHeld = () => {
        const pending = current();
        if (!pending) return false;
        if (!pending.choice && pending.mode !== 'working') begin(false);
        tell(); show();
        return true;
    };
    const click = event => { if (event.target?.closest?.('#send_but')) stopSend(event); };
    const key = event => {
        if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.isComposing || doc.activeElement !== doc.getElementById?.('send_textarea')) return;
        let sends = true;
        try { sends = globalThis.SillyTavern?.getContext?.()?.shouldSendOnEnter?.() !== false; } catch { /* use the usual Enter action */ }
        if (sends) stopSend(event);
    };
    doc.addEventListener?.('click', click, true);
    doc.addEventListener?.('keydown', key, true);
    const sheetState = () => (current()?.opening ? (preview?.()?.state ?? state()) : state());
    // The pause's data and the foe groups it names (`{ name, count, level, tier }`: the pre-check's opening, or the standing foes on the sheet), for a pause with no choice yet.
    const pauseOf = pending => {
        if (pending.mode === 'working') return { data: pauseViewData({ working: true }), foes: [] };
        if (pending.opening) return { data: pauseViewData({ opening: pending.result, cap: cap() }), foes: (Array.isArray(pending.result?.opened) ? pending.result.opened : []) };
        const live = state(), standing = readSheet(live).foes.filter(foe => foe.filled && foe.hurt > 0);
        return { data: pauseViewData({ fight: { groups: standing.map(foe => foe.slot) }, state: live, cap: cap() }), foes: standing };
    };
    const draw = root => {
        const pending = current();
        if (!pending || pending.choice) { error = ''; pause.clear(); return false; }
        const { data } = pauseOf(pending);
        if (!data) return false;
        pause.render(root, error ? { ...data, note: error } : data);
        return true;
    };
    // What the Suite view draws for the waiting choice (board/hold-bridge.js): the pause's words and foes, or, once the board was chosen, only that (the Fight tab shows the board). Null when nothing waits.
    const info = () => {
        const pending = current();
        if (!pending) return null;
        const base = { id: String(pending.id ?? ''), kindId: String(pending.kindId ?? ''), mode: pending.mode, choice: pending.choice ?? null, sending, error };
        if (pending.choice) return base;
        const { data, foes } = pauseOf(pending);
        if (!data) return null;
        return { ...base, ...data, foes: foes.filter(foe => foe?.name).map(foe => ({ name: String(foe.name), count: Number(foe.count) || 1, level: Number(foe.level) || 1, tier: String(foe.tier ?? '') })) };
    };
    return {
        current, holds, openHeld, draw, info, state: sheetState, send, changed: tell, sending: () => sending,
        // The pause's three answers, as its buttons give them (the Suite view's offer card calls these through the bridge).
        board: () => begin(false), auto: () => begin(true), plain,
        waiting: () => current()?.choice === 'board',
        // The fight is discarded (`run`): the interaction api drops the waiting choice with it, so it is put back, as it was before the board was chosen (the pause shows again).
        discard(run = () => {}) {
            const pending = current(), keep = pending?.choice === 'board' ? structuredClone(pending) : null;
            run();
            error = '';
            if (!keep) return;
            keep.choice = null;
            const box = meta()?.storySuiteInteraction;
            if (box && typeof box === 'object') box.start = keep;
            clearSend(); persist();
        },
        listen(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        clear: () => pause.clear(),
        destroy() { listeners.clear(); doc.removeEventListener?.('click', click, true); doc.removeEventListener?.('keydown', key, true); pause.destroy(); },
    };
}
