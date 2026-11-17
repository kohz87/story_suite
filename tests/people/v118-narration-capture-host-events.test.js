import test from 'node:test';
import { runScenario } from './v118-narration-capture-host.helpers.js';

test('v1.1.8 a stored capture is not reused after the reply text changes', () => {
    runScenario('edited-reply', async h => {
        h.settings.narrationCapture = true;
        await h.turn('Who is at the gate?', 'A quiet wind crosses the gate.');
        const before = h.scannerCalls().length;
        h.equal(before, 1, 'the armed reply without a block fell back to one scanner request');
        // Hold the next scanner request open so the capture reply's scan is queued, not run.
        let release;
        const held = new Promise(resolve => { release = resolve; });
        const responder = h.mockState.quietResponder;
        h.mockState.quietResponder = async (...args) => { await held; return responder(...args); };
        const manual = h.runtime.scan();
        await h.sleep(20);
        h.equal(h.scannerCalls().length, before + 1, 'a manual scan is in flight');
        await h.sendUser('Who is that?');
        await h.generate('normal');
        const id = await h.receiveAssistant(`${h.REPLY}${h.block()}`);
        h.equal(h.mockState.context.chat[id].mes, h.REPLY);
        h.equal(h.status().pending, 1, 'the capture is stored while the scan is busy');
        // The player edits the reply before the queued scan runs.
        const edited = 'Yunyun, a young woman with crimson eyes, waits silently at the gate.';
        h.mockState.context.chat[id].mes = edited;
        h.mockState.context.chat[id].swipes[0] = edited;
        await h.emitAsync('message_edited', id);
        h.mockState.quietResponder = responder;
        release();
        await manual;
        await h.sleep(700);
        const after = h.scannerCalls().slice(before + 1);
        h.check(after.some(args => String(args.prompt).includes(edited)), `the edited reply was rescanned with a real request (${after.length} later requests)`);
        h.equal(h.status().used, 0, 'the stale capture was never merged');
        h.equal(h.npc('Yunyun')?.role, 'scanned adventurer', 'the dossier comes from the rescan, not the stale block');
    });
});

test('v1.1.8 with a host makeFirst the block is stripped before earlier-registered listeners run', () => {
    runScenario('make-first', async h => {
        h.settings.narrationCapture = true;
        await h.turn('Who is at the gate?', `${h.REPLY}${h.block()}`);
        h.equal(h.mockState.earlierListenerSaw, [h.REPLY], 'a listener registered before the extension already sees the stripped reply');
        h.equal(h.scannerCalls().length, 0);
        h.equal(h.status().used, 1);
    }, { makeFirst: true });
});

test('v1.1.9 a capture survives another extension rewriting the reply on arrival', () => {
    runScenario('rewritten-reply', async h => {
        h.settings.narrationCapture = true;
        // Another extension listening after the strip wraps its own blocks into a comment, so the
        // reply text the scan reads differs from the text Delta stripped (a reported live case).
        const wrapped = '\n\n<!-- STORY_BLOCKS_V1\n<Blocks>\n<CYOA>\n1. Go to the gate.\n</CYOA>\n</Blocks>\n-->';
        const list = h.mockState.listeners.get('message_received');
        list.splice(1, 0, id => { h.mockState.context.chat[id].mes += wrapped; });
        const id = await h.turn('Who is at the gate?', `${h.REPLY}${h.block()}`);
        h.equal(h.mockState.context.chat[id].mes, `${h.REPLY}${wrapped}`, 'the other extension rewrote the stripped reply');
        h.equal(h.scannerCalls().length, 0, 'the capture is still used: no scanner request');
        h.equal([h.status().used, h.status().pending], [1, 0]);
        h.equal(h.npc('Yunyun')?.role, 'adventurer', 'the dossier comes from the block');
        const exported = h.runtime.diagnosticBundle().narrationCapture;
        h.equal([exported.requested, exported.used, exported.pending], [1, 1, 0], 'the diagnostics export carries the counters');
        h.check(!JSON.stringify(exported).includes('Yunyun'), 'and no block content');

    }, { makeFirst: true });
});

test('v1.1.8 tag and fence near-misses are accepted only from an armed reply; unarmed ones stay intact', () => {
    runScenario('lenient-forms', async h => {
        h.settings.narrationCapture = true;
        const fence = `\n\n\`\`\`json\n${JSON.stringify({ npcs: [h.YUNYUN] })}\n\`\`\``;
        await h.sendUser('Who is at the gate?');
        const unarmed = await h.receiveAssistant(`${h.REPLY}${fence}`);
        h.equal(h.mockState.context.chat[unarmed].mes, `${h.REPLY}${fence}`, 'an unarmed reply keeps its fence (strict mode)');
        h.equal(h.mockState.context.chat[unarmed].swipes[0], `${h.REPLY}${fence}`);
        h.equal(h.scannerCalls().length, 1, 'and is scanned normally');
        h.equal(h.npc('Yunyun')?.role, 'scanned adventurer');

        const tag = `\n<npc_state_delta>${JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, role: 'tagged adventurer' }] })}</npc_state_delta>`;
        await h.sendUser('And now?');
        const unarmedTag = await h.receiveAssistant(`${h.REPLY}${tag}`);
        h.equal(h.mockState.context.chat[unarmedTag].mes, `${h.REPLY}${tag}`, 'an unarmed tag form is left intact');
        h.equal(h.scannerCalls().length, 2, 'and is scanned normally');

        const second = 'Yunyun now waits at the guild hall, nervously polishing her wand.';
        const update = { npcs: [{ name: 'Yunyun', present: true, location: 'guild hall', relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] };
        const armedId = await h.turn('I go to the guild hall.', `${second}\n<npc_state_delta>${JSON.stringify(update)}</npc_state_delta>`);
        h.equal(h.mockState.context.chat[armedId].mes, second, 'an armed reply has its tag form removed (lenient)');
        h.equal(h.scannerCalls().length, 2, 'and the armed tag form replaces the scan');
        h.check(/guild hall/i.test(String(h.npc('Yunyun').location || '')), 'the tag form was merged');
        const fenceId = await h.turn('We sit down.', `They sit at a table.\n\`\`\`json\n${JSON.stringify({ npcs: [{ name: 'Yunyun', present: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] })}\n\`\`\``);
        h.equal(h.mockState.context.chat[fenceId].mes, 'They sit at a table.', 'an armed trailing fence is removed (lenient)');
        h.equal(h.scannerCalls().length, 2);
        h.equal([h.status().requested, h.status().used], [2, 2]);
    });
});

test('v1.1.8 a dossier change between the prompt and the reply makes the block outdated', () => {
    runScenario('outdated', async h => {
        h.settings.narrationCapture = true;
        await h.sendUser('Who is at the gate?');
        await h.generate('normal');
        h.equal(h.status().armed, true);
        // The player adds a dossier while the reply is being generated.
        await h.manualAddNpc('Wiz');
        h.check(h.npc('Wiz'), 'the manual add landed');
        const id = await h.receiveAssistant(`${h.REPLY}${h.block()}`);
        h.equal(h.mockState.context.chat[id].mes, h.REPLY, 'the comment block is still stripped');
        h.equal([h.status().requested, h.status().outdated, h.status().used, h.status().pending], [0, 1, 0, 0], 'counted as outdated, never stored');
        h.equal(h.scannerCalls().length, 1, 'the normal scanner request runs');
        h.equal(h.npc('Yunyun')?.role, 'scanned adventurer', 'the outdated block is not merged');
        h.check(h.npc('Wiz'), 'the manual dossier survives');

        // Without an intervening write the next reply is current again.
        await h.turn('And then?', `${h.REPLY} Again.${h.block({ npcs: [{ name: 'Yunyun', present: true, relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] })}`);
        h.equal([h.status().requested, h.status().outdated, h.status().used], [1, 1, 1]);
        h.equal(h.scannerCalls().length, 1);
    });
});

test('v1.1.8 editing the earlier user message retires a pending capture', () => {
    runScenario('edited-user-message', async h => {
        h.settings.narrationCapture = true;
        await h.turn('Who is at the gate?', 'A quiet wind crosses the gate.');
        const before = h.scannerCalls().length;
        let release;
        const held = new Promise(resolve => { release = resolve; });
        const responder = h.mockState.quietResponder;
        h.mockState.quietResponder = async (...args) => { await held; return responder(...args); };
        const manual = h.runtime.scan();
        await h.sleep(20);
        await h.sendUser('Who is that?');
        await h.generate('normal');
        const id = await h.receiveAssistant(`${h.REPLY}${h.block()}`);
        h.equal(h.status().pending, 1, 'the capture is stored while the scan is busy');
        const editedUser = 'Who is that girl with the crimson eyes?';
        h.mockState.context.chat[id - 1].mes = editedUser;
        await h.emitAsync('message_edited', id - 1);
        h.mockState.quietResponder = responder;
        release();
        await manual;
        await h.sleep(700);
        const after = h.scannerCalls().slice(before + 1);
        h.check(after.some(args => String(args.prompt).includes(editedUser) && String(args.prompt).includes('Yunyun tells Kazuma')), `the reply was rescanned with a real request after the user edit (${after.length} later requests)`);
        h.equal(h.status().used, 0, 'the capture written for the old user message was never merged');
        h.equal(h.npc('Yunyun')?.role, 'scanned adventurer');
    });
});

test('v1.1.8 every swipe entry is stripped at receipt, leniently only when armed', () => {
    runScenario('swipe-entries', async h => {
        h.settings.narrationCapture = true;
        await h.sendUser('Who is at the gate?');
        await h.generate('normal');
        const older = 'An older sibling reply.';
        const olderTag = 'A tagged sibling.';
        const current = `${h.REPLY}${h.block()}`;
        const id = await h.receiveAssistant(current, {
            swipes: [`${older}${h.block({ npcs: [{ name: 'Old' }] })}`, `${olderTag}\n<npc_state_delta>{"npcs":[]}</npc_state_delta>`, current],
            swipeId: 2,
        });
        h.equal(h.mockState.context.chat[id].swipes, [older, olderTag, h.REPLY], 'all swipe strings are stripped (armed: lenient)');
        h.equal(h.status().used, 1);

        await h.sendUser('Next?');
        const unarmedTag = 'Unarmed tagged sibling.\n<npc_state_delta>{"npcs":[]}</npc_state_delta>';
        const plain = 'A plain reply.';
        const id2 = await h.receiveAssistant(plain, { swipes: [`Hidden sibling.${h.block()}`, unarmedTag, plain], swipeId: 2 });
        h.equal(h.mockState.context.chat[id2].swipes, ['Hidden sibling.', unarmedTag, plain], 'unarmed: comment blocks stripped, tag form kept (strict)');
    });
});

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

test('v1.1.8 CHAT_CHANGED disarms the instruction', () => {
    runScenario('chat-changed', async h => {
        h.settings.narrationCapture = true;
        await h.sendUser('Who is at the gate?');
        await h.generate('normal');
        h.equal(h.status().armed, true);
        await h.emitAsync('chat_changed');
        await h.sleep(150);
        h.equal(h.status().armed, false, 'a chat change disarms');
        h.check(!h.asked(), 'the instruction is no longer injected');
        const id = await h.receiveAssistant(`${h.REPLY}${h.block()}`);
        h.equal(h.mockState.context.chat[id].mes, h.REPLY, 'the block is still stripped');
        h.equal(h.scannerCalls().length, 1, 'the reply is scanned normally');
        h.equal([h.status().requested, h.status().used, h.status().pending], [0, 0, 0]);
    });
});

test('v1.1.8 GENERATION_STOPPED disarms the instruction', () => {
    runScenario('generation-stopped', async h => {
        h.settings.narrationCapture = true;
        await h.sendUser('Who is at the gate?');
        await h.generate('normal');
        h.check(h.lastPrompt().includes(h.HEADER));
        await h.emitAsync('generation_stopped');
        h.equal(h.status().armed, false, 'a stopped generation disarms');
        h.check(!h.asked(), 'and withdraws the instruction at once');
        h.equal(h.runtime.injectionPreview().captureChars, h.rulesNow().length, 'only the fixed rules remain');
        const id = await h.receiveAssistant(`${h.REPLY}${h.block()}`);
        h.equal(h.mockState.context.chat[id].mes, h.REPLY);
        h.equal(h.scannerCalls().length, 1, 'a later reply is scanned normally');
        h.equal([h.status().requested, h.status().used], [0, 0]);
    });
});

// (1.2.11) One-pass catch-up: every N captured replies, the NPCs most in them get a quiet Refresh.
test('v1.2.11 one-pass catch-up refreshes the NPCs most in the last N captured replies, quietly', () => {
    runScenario('catch-up', async h => {
        h.settings.narrationCapture = true;
        h.settings.narrationCaptureCatchUp = 2;
        const refreshCalls = () => h.mockState.rawCalls.map(call => call?.[0] || {}).filter(args => /targeted dossier reconciliation scanner/i.test(String(args.systemPrompt || '')));
        const toasts = [];
        for (const level of ['info', 'success', 'warning']) {
            const before = globalThis.toastr?.[level];
            if (globalThis.toastr) globalThis.toastr[level] = (text, ...rest) => { toasts.push(`${level}: ${text}`); return before?.(text, ...rest); };
        }
        await h.turn('Who is at the gate?', `${h.REPLY}${h.block()}`);
        h.equal(refreshCalls().length, 0, 'not after one captured reply');
        const update = { npcs: [{ name: 'Yunyun', present: true, location: 'guild hall', relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] };
        await h.turn('I go to the guild hall.', `Yunyun waits at the guild hall.${h.block(update)}`);
        await h.sleep(300);
        h.equal(h.scannerCalls().length, 0, 'the captures themselves still need no scan');
        h.equal(refreshCalls().length, 1, 'one Refresh after the second captured reply');
        h.check(String(refreshCalls()[0].prompt || '').includes('Yunyun'), 'for the NPC in those replies');
        h.check(!toasts.some(text => /Yunyun is already consistent|no grounded dossier changes/i.test(text)), `a catch-up that changes nothing says nothing: ${toasts.join(' | ')}`);
        // Off: no catch-up.
        h.settings.narrationCaptureCatchUp = 0;
        await h.turn('We wait.', `Yunyun polishes her wand.${h.block(update)}`);
        await h.turn('We wait more.', `Yunyun sighs.${h.block(update)}`);
        await h.sleep(300);
        h.equal(refreshCalls().length, 1, 'none with the setting at 0');
    });
});


// ---- 1.10.0 (L2a): a capture read its own reply; the replies that still wait are read by the next scan, and that scan skips the captured one ----

test('v1.10.0 a capture leaves the marker behind waiting replies; the next scan reads them and not the captured reply', () => {
    runScenario('capture-read-ahead', async h => {
        h.settings.narrationCapture = true;
        h.settings.scanEvery = 30;
        for (let i = 1; i <= 3; i += 1) await h.turn('We walk on.', `The road goes on, mile ${i} of marker-${i}.`);
        h.equal(h.scannerCalls().length, 0, 'quiet replies: no scanner request');
        const id = await h.turn('Who is at the gate?', `${h.REPLY}${h.block()}`);
        h.equal(h.scannerCalls().length, 0, 'the capture made no scanner request');
        const state = h.runtime.getState();
        h.equal(state.readAhead, [id], 'the captured reply is remembered as read');
        h.check(state.lastScannedMessageId < id, 'the marker stayed behind the three waiting replies');
        h.equal(state.assistantSinceScan, 3, 'the three unread replies count toward the safety scan');
        await h.turn('And then?', 'Yunyun says nothing more, and Megumin watches her go.');
        h.equal(h.scannerCalls().length, 1, 'a tracked name scans');
        const prompt = String(h.scannerCalls()[0].prompt || '');
        h.check(['marker-1.', 'marker-2.', 'marker-3.', 'Megumin watches her go'].every(text => prompt.includes(text)), 'the waiting replies and the new one are read');
        h.check(!prompt.includes('waves awkwardly'), 'the captured reply is not read again');
        h.equal(h.runtime.getState().readAhead, [], 'nothing is left read ahead');
        h.equal(h.runtime.getState().lastScannedMessageId, h.mockState.context.chat.length - 1, 'the marker is at the latest reply');
    });
});
