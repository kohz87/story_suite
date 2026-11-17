// The touch-first fight board: status chips (foe groups, party), a one-line log, the choosing member's Mana/Stamina strip and a grid of skill buttons.
// It reads the staged session and calls its pure rules; only metadata holds unsent choices.
// Text is placed in DOM nodes, never interpreted as markup.

import { button, h } from '../../../ui/legacy/view/widgets/dom.js';
import { discardHeld } from '../../../core/interaction/held.js';
import { readSheet } from '../read.js';
import { isStandard } from '../rules.js';
import { FIGHT_KIND, heldFight, openFight } from './port-session.js';
import { sessionProblem } from './session-check.js';
import { resumeFoesV1 } from './resume-v1.js';
import { AUTO_CAP, autoExchanges } from '../names.js';
import { autoNote, runAuto } from './auto-run.js';
import { renderV1 } from './view-v1.js';

// A foe that stands: a v1 slot has no hurt bar, a filled slot stands until a fight clears it.
const isStanding = foe => foe.filled;

export function createBoardView({ doc, headState, meta, save, store, interaction, rules, query, readerName, roleOf, levels, on = () => false, start = null, practice = () => undefined, rate = () => undefined, cap = () => AUTO_CAP.default } = {}) {
    let notice = '', autoLine = '', confirm = false, activeId = null;
    const persist = () => { try { save?.(); } catch { /* staging still works in this page */ } };
    const current = () => openFight(meta());
    const reset = () => { confirm = false; notice = ''; autoLine = ''; };
    // A v1 fight's play is the kind's (the page never calls the old engine on it): what the Fight view says, with the result the page's readers know.
    const v1Played = state => {
        const now = interaction?.current?.();
        return now?.view?.result && Array.isArray(now.view.actors) ? { state, result: now.view.result, v1: now } : { error: 'The fight could not be played.' };
    };
    const snapshot = state => {
        if (!on()) return null;
        const index = store?.headIndex?.(), sid = store?.carrierSid?.(index);
        const held = heldFight(meta(), sid, (store?.receipts?.() ?? []).filter(entry => entry.index === index).map(entry => entry.receipt));
        const session = current() ?? held?.fight ?? null;
        if (!session) return null;
        const matched = session.anchor === sid;
        if (!held && !matched && !session.exchanges.length) return null;
        if (session.id !== activeId) { activeId = session.id; reset(); }
        const played = held ? { error: held.discarded
            ? 'The fight was discarded. Regenerate the held reply.'
            : 'The fight reply is waiting. Restore the sheet or gear, or discard the fight (Fight tab, Discard fight) and regenerate the reply.' }
            : !matched ? { error: 'The fight no longer matches this reply. Restore the reply or discard the fight (Fight tab, Discard fight).' }
            : !isStandard(rules()) ? { error: 'The fight board needs Standard rules. Switch back to Standard or discard this fight.' }
            : sessionProblem(session, state) ? { error: sessionProblem(session, state) }
            : v1Played(state);
        return { session, played, heldSid: held ? sid : null };
    };
    // Whether the Fight tab draws a board now (the gate of `snapshot`, with none of its writes): a held reply's fight, a staged exchange, or a board
    // open on the head reply. The Fight tab stays listed for it with no foe on the sheet, so "Fight tab, Discard fight" always has a place to go.
    const kept = () => {
        if (!on()) return false;
        const index = store?.headIndex?.(), sid = store?.carrierSid?.(index), session = current();
        if (heldFight(meta(), sid, (store?.receipts?.() ?? []).filter(entry => entry.index === index).map(entry => entry.receipt))) return true;
        return Boolean(session) && (session.exchanges?.length > 0 || session.anchor === sid);
    };
    const open = ({ state = headState() } = {}) => {
        if (!on() || !isStandard(rules())) return false;
        const sheet = readSheet(state);
        // A fight against the foes a fled or lost fight left starts from the foes' HP that fight's receipt holds (resume-v1.js), if the Foes block still reads what the board left.
        const resumed = resumeFoesV1(store?.receipts?.() ?? [], sheet.foes.filter(foe => foe.v1 === true && foe.filled));
        const result = interaction?.open?.(FIGHT_KIND, { rules: rules(), practice: practice(), rate: rate(), ...(resumed ? { resumed } : {}) });
        if (!result?.ok) return false;
        reset();
        activeId = current()?.id ?? null;   // (the first draw must not reset what Auto says)
        return true;
    };
    // Auto plays up to the cap's exchanges on the staged fight; every one is an ordinary staged exchange, and the reader may pick by hand after.
    const auto = () => {
        if (!current()) return false;
        const ran = runAuto({ api: interaction, cap: autoExchanges(cap()) });
        if (ran.error && !ran.done) { notice = ran.error; return false; }
        confirm = false; notice = ran.error ?? '';
        autoLine = autoNote({ ...ran, waiting: Boolean(start?.waiting?.()) });
        persist();
        return true;
    };
    const offer = (root, redraw) => {
        if (!on() || !isStandard(rules())) return;
        const state = headState(), sheet = readSheet(state);
        if (!sheet.foes.some(isStanding)) return;
        const box = h(doc, 'div', 'rpg-board-offer ss-glass');
        box.appendChild(h(doc, 'p', '', 'Choose each exchange on the fight board, or keep telling the story.'));
        box.appendChild(button(doc, 'Fight on the board', 'ss-button ss-button-primary rpg-board-open', () => {
            if (!open()) { box.appendChild(h(doc, 'p', 'rpg-board-error', 'The fight could not be opened.')); return; }
            redraw();
        }));
        box.appendChild(button(doc, 'Auto-fight', 'ss-button rpg-board-open-auto', () => {
            if (!open()) { box.appendChild(h(doc, 'p', 'rpg-board-error', 'The fight could not be opened.')); return; }
            auto(); redraw();
        }));
        root.appendChild(box);
    };
    const render = (root, snapshot, redraw, handles, settings = {}) => {
        const { session, played, heldSid } = snapshot;
        // (a held reply's fight may be open no more: its marker is discarded by the fight's interaction id)
        const discard = () => {
            const run = () => { if (interaction?.current?.()) interaction.discard(interaction.current().id); if (heldSid) discardHeld(meta(), session.interactionId); };
            if (start?.discard) start.discard(run); else run();
            persist(); reset(); redraw();
        };
        const confirmDiscard = panel => {
            panel.appendChild(h(doc, 'p', '', 'Discard this fight and its unsent exchanges?'));
            const pair = h(doc, 'div', 'rpg-board-actions rpg-board-confirm-row');   // one row, 8px apart (never stacked)
            pair.appendChild(button(doc, 'Discard fight', 'ss-button rpg-board-confirm', discard));
            pair.appendChild(button(doc, 'Cancel', 'ss-button', () => { confirm = false; redraw(); }));
            panel.appendChild(pair);
        };
        if (notice) root.appendChild(h(doc, 'p', 'rpg-board-error', notice));
        root.classList.add('rpg-board-active');
        root.classList.toggle('rpg-board-finished', !played.error && played.result.stop !== 'open');
        if (played.error) {
            root.appendChild(h(doc, 'p', 'rpg-board-error', played.error));
            const panel = h(doc, 'div', 'rpg-board-controls');
            if (confirm) confirmDiscard(panel); else panel.appendChild(button(doc, 'Discard fight', 'ss-button rpg-board-discard', () => { confirm = true; redraw(); }));
            root.appendChild(panel);
            return;
        }
        if (played.v1) {
            root.classList.add('rpg-board-members');
            if (notice) root.appendChild(h(doc, 'p', 'rpg-board-error', notice));
            const stage = step => {
                const result = interaction?.stage?.(session.interactionId, step) ?? { ok: false, message: 'The fight could not be played.' };
                notice = result.ok ? '' : result.message;
                if (result.ok) persist();
                redraw();
            };
            const tools = { stage, auto: () => { auto(); redraw(); }, discard: () => { confirm = true; redraw(); }, waiting: () => Boolean(start?.waiting?.()), sending: () => Boolean(start?.sending?.()), send: () => { start.send(); redraw(); }, redraw };
            if (confirm) { const box = h(doc, 'div', 'rpg-board-controls'); confirmDiscard(box); root.appendChild(box); return; }
            if (autoLine) root.appendChild(h(doc, 'p', 'rpg-board-auto-note', autoLine));
            renderV1(root, { doc, id: session.id, steps: session.steps.length, view: played.v1.view, tools });
            return;
        }
    };
    return { open, auto, kept, snapshot, offer, render, clear() {}, destroy() {} };
}
