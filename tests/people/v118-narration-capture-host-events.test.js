import test from 'node:test';
import { runScenario } from './v118-narration-capture-host.helpers.js';

test('v1.1.8 MESSAGE_SWIPED strictly strips the swiped message before other listeners', () => {
    runScenario('message-swiped', async h => {
        h.settings.narrationCapture = true;
        const id = await h.turn('Who is at the gate?', 'A quiet wind crosses the gate.');
        const message = h.mockState.context.chat[id];
        const sibling = 'Yunyun appears at the gate.';
        const tagged = 'Tagged sibling.\n<npc_state_delta>{"npcs":[]}</npc_state_delta>';
        message.swipes = ['A quiet wind crosses the gate.', `${sibling}${h.block()}`, tagged];
        message.swipe_id = 1;
        message.mes = message.swipes[1];
        const listeners = h.mockState.listeners.get('message_swiped') || [];
        h.check(listeners.length >= 2, 'the strip and the reconcile listeners are both registered');
        // Only the first listener (placed by makeFirst) runs here.
        listeners[0](id);
        h.equal(message.mes, sibling, 'the swiped-to text is stripped by the first listener');
        h.equal(message.swipes, ['A quiet wind crosses the gate.', sibling, tagged], 'every stored swipe loses its comment block; the tag form stays (strict)');
        h.equal(h.status().used, 0, 'a swipe never merges a block');
    }, { makeFirst: true });
});

// (1.2.11) One-pass catch-up: every N captured replies, the NPCs most in them get a quiet Refresh.

// ---- 1.10.0 (L2a): a capture read its own reply; the replies that still wait are read by the next scan, and that scan skips the captured one ----
