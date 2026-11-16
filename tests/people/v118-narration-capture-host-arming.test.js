import test from 'node:test';
import { runScenario } from './v118-narration-capture-host.helpers.js';

test('v1.1.8 capture arms only fresh replies and continues (not quiet/swipe/regenerate/impersonate/dry-run)', () => {
    runScenario('injection-arming', async h => {
        h.settings.narrationCapture = true;
        await h.sendUser('Who is at the gate?');
        h.equal(h.status().enabled, true, 'capture mode is enabled with Auto scan on');
        h.equal(h.status().armed, false, 'nothing is armed before a generation');
        h.check(!h.asked(), 'no capture instruction before a generation');
        h.check(h.rulesNow().startsWith(h.HEADER), 'the fixed rules are already in the system prompt');

        await h.generate('normal');
        h.check(h.lastPrompt().includes(h.HEADER), 'a normal generation carries the capture instruction');
        h.check(h.lastPrompt().includes('<!--npc_state_delta'), 'the instruction names the hidden block');
        h.check(h.lastPrompt().trimEnd().endsWith('"relationshipReview": ["Name"].'), 'the reminder is the last thing in the injection');
        const sent = h.captureCalls().at(-1);
        h.check(String(sent?.[1] ?? '').includes('"relationshipReview": ["Name"].') && sent?.[2] === 1 && sent?.[3] === 0, 'the context and reminder go in their own slot at depth 0, the end of the prompt');
        const rules = h.rulesCalls().at(-1);
        h.check(String(rules?.[1] ?? '').startsWith(h.HEADER) && rules?.[2] === 0, 'the rules go in the system prompt (IN_PROMPT)');
        h.check(!String(rules?.[1] ?? '').includes('Identity index'), 'the rules carry no dossier context');
        h.check(!h.dossierPrompts().at(-1)?.includes(h.HEADER), 'the dossier slot carries no reminder');
        h.check(!h.lastPrompt().includes('Who is at the gate?'), 'the capture instruction carries no transcript');
        h.check(h.runtime.injectionPreview().captureChars > 1000, 'the preview reports the capture size');
        h.equal(h.status().armed, true, 'armed after a normal generation');
        h.equal(h.status().requested, 0, 'requested is counted at receipt, not at arming');

        await h.generate('quiet');
        h.check(!h.lastPrompt().includes(h.HEADER), 'a quiet generation removes the capture instruction');
        h.equal(h.status().armed, false, 'quiet disarms');
        h.equal(h.runtime.injectionPreview().captureChars, 0);

        for (const type of ['swipe', 'regenerate', 'impersonate']) {
            await h.generate('normal');
            h.equal(h.status().armed, true, `armed before ${type}`);
            const normalRules = h.rulesNow();
            await h.generate(type);
            h.check(!h.asked(), `${type} never asks for a block`);
            h.equal(h.status().armed, false, `${type} disarms`);
            if (type === 'impersonate') {
                h.check(!h.lastPrompt().includes(h.HEADER), 'impersonate carries no capture rules');
                h.equal(h.runtime.injectionPreview().captureChars, 0, `${type} sends no capture`);
            } else {
                // (b6-soak-3) The fixed rules stay, byte-identical, so the prompt's cached head is the same.
                h.equal(h.rulesNow(), normalRules, `${type} keeps the rules in the system prompt`);
                h.equal(h.runtime.injectionPreview().captureChars, normalRules.length, `${type} sends the rules only`);
            }
        }
        for (const type of ['continue', '', undefined]) {
            await h.generate('quiet');
            await h.generate(type);
            h.check(h.lastPrompt().includes(h.HEADER), `${JSON.stringify(type)} carries the capture instruction`);
            h.equal(h.status().armed, true, `${JSON.stringify(type)} arms`);
        }

        await h.generate('normal');
        const armedPrompt = h.lastPrompt();
        const promptCount = h.dossierPrompts().length;
        await h.generate('quiet', true);
        await h.generate('impersonate', true);
        await h.generate('swipe', true);
        h.equal(h.dossierPrompts().length, promptCount, 'dry runs never rebuild the injection');
        h.equal(h.lastPrompt(), armedPrompt, 'dry runs leave the armed instruction in place');
        h.equal(h.status().armed, true, 'dry runs do not disarm');

        // The instruction is sent even when the dossier injection itself is off.
        h.settings.inject = false;
        await h.generate('normal');
        h.check(h.lastPrompt().startsWith(h.HEADER), 'with Inject off the capture instruction is sent alone');
        h.equal(h.runtime.injectionPreview().text, '', 'no dossier text is sent with Inject off');
        await h.generate('quiet');
        h.equal(h.lastPrompt(), '', 'quiet with Inject off clears the prompt entirely');
        h.equal(h.scannerCalls().length, 0, 'arming never makes a scanner request');
        h.equal(h.status().requested, 0, 'no reply was received');

        // (1.2.16) A preset with its Main Prompt off drops the in-prompt rules: they go back in at
        // prompt-ready, after the leading system messages, once; never into a dry run or a quiet call.
        h.settings.inject = true;
        await h.generate('normal');
        const rulesText = String(h.rulesCalls().at(-1)?.[1] ?? '');
        const dropped = { chat: [{ role: 'system', content: 'Card.' }, { role: 'system', content: 'Scenario.' }, { role: 'user', content: 'Hi' }, { role: 'system', content: 'tail' }], dryRun: false };
        await h.emitAsync('chat_completion_prompt_ready', dropped);
        h.equal(dropped.chat.map(message => message.role), ['system', 'system', 'system', 'user', 'system'], 'inserted after the leading system messages');
        h.equal(dropped.chat[2].content, rulesText.trim(), 'the rules, as sent');
        await h.emitAsync('chat_completion_prompt_ready', dropped);
        h.equal(dropped.chat.length, 5, 'only once: a prompt that already carries them is left alone');
        const dry = { chat: [{ role: 'user', content: 'Hi' }], dryRun: true };
        await h.emitAsync('chat_completion_prompt_ready', dry);
        h.equal(dry.chat.length, 1, 'never into a dry run');
        const ownScan = { chat: [{ role: 'system', content: "You are NPC State Delta's isolated dossier scanner. Use only the supplied scanner payload." }, { role: 'user', content: 'payload' }], dryRun: false };
        await h.emitAsync('chat_completion_prompt_ready', ownScan);
        h.equal(ownScan.chat.length, 2, "never into Delta's own scanner request");
        await h.generate('quiet');
        const quiet = { chat: [{ role: 'user', content: 'Hi' }], dryRun: false };
        await h.emitAsync('chat_completion_prompt_ready', quiet);
        h.equal(quiet.chat.length, 1, 'never into a quiet call');
        // Once the chat has replies, only a prompt that carries them is the story's own.
        await h.generate('normal');
        h.mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: 'Earlier reply.' });
        const background = { chat: [{ role: 'system', content: 'Summarize.' }, { role: 'user', content: 'text' }], dryRun: false };
        await h.emitAsync('chat_completion_prompt_ready', background);
        h.equal(background.chat.length, 2, "never into another extension's call without the chat's replies");
        const story = { chat: [{ role: 'system', content: 'Card.' }, { role: 'assistant', content: 'Earlier reply.' }, { role: 'user', content: 'Hi' }], dryRun: false };
        await h.emitAsync('chat_completion_prompt_ready', story);
        h.equal(story.chat.length, 4, 'the story prompt gets them');
        h.mockState.context.chat.pop();
        await h.emitAsync('generation_stopped');
        const stopped = { chat: [{ role: 'user', content: 'Hi' }], dryRun: false };
        await h.emitAsync('chat_completion_prompt_ready', stopped);
        h.equal(stopped.chat.length, 1, 'not after the generation is stopped');

        // (1.2.16) The dossier goes last (depth 0) by default; the old default 1 moves there once,
        // any other depth the player set is kept, and so is a 1 set after the move.
        const dossierDepth = () => h.mockState.prompts.filter(args => args[0] === 'story_suite_tail_4_npc_state_delta').at(-1)?.[3];
        h.settings.inject = true;
        h.settings.injectDepth = 1;
        h.settings.injectDepthTailUpgraded = false;
        await h.generate('normal');
        h.equal(dossierDepth(), 0, 'an install on the old default 1 is moved to depth 0');
        h.settings.injectDepth = 3;
        await h.generate('normal');
        h.equal(dossierDepth(), 3, 'a depth the player chose is kept');
        h.settings.injectDepth = 1;
        await h.generate('normal');
        h.equal(dossierDepth(), 1, 'a 1 chosen after the move is kept');
        h.settings.injectDepth = 0;
        await h.generate('normal');
        h.equal(dossierDepth(), 0, '0 is honoured');

        // (1.2.17) The opt-in compact rules: shorter, still in the system prompt, the same each reply.
        const fullRules = String(h.rulesCalls().at(-1)?.[1] ?? '');
        h.equal(h.settings.narrationCaptureCompact, false, 'the compact instruction is off by default');
        h.settings.narrationCaptureCompact = true;
        await h.generate('normal');
        const compactRules = String(h.rulesCalls().at(-1)?.[1] ?? '');
        h.check(compactRules.startsWith(h.HEADER) && compactRules.length < fullRules.length * 0.9 && h.rulesCalls().at(-1)?.[2] === 0, 'the compact rules are shorter and still go in the system prompt');
        await h.generate('normal');
        h.equal(String(h.rulesCalls().at(-1)?.[1] ?? ''), compactRules, 'the compact rules are byte-identical reply to reply');
        h.settings.narrationCaptureCompact = false;
        await h.generate('normal');
        h.equal(String(h.rulesCalls().at(-1)?.[1] ?? ''), fullRules, 'off sends the full rules again');
    });
});

test('v1.1.8 Capture mode off never arms; Auto scan off no longer blocks it (ONEPASSMISS-2)', () => {
    runScenario('arming-gates', async h => {
        await h.sendUser('Who is at the gate?');
        await h.generate('normal');
        h.equal(h.status().armed, false, 'off by default');
        h.settings.narrationCapture = true;
        h.settings.autoScan = false;
        await h.generate('normal');
        h.equal(h.status().enabled, true, 'one-pass with Auto scan off is never a silent no-capture state');
        h.equal(h.status().armed, true, 'the capture instruction is sent with Auto scan off');
        h.check(h.lastPrompt().includes(h.HEADER), 'the capture instruction was injected');
    });
});

test('v1.1.8 a valid capture block is stripped and merged without a scanner request', () => {
    runScenario('valid-block', async h => {
        h.settings.narrationCapture = true;
        const id = await h.turn('Who is at the gate?', `${h.REPLY}${h.block()}`);
        const message = h.mockState.context.chat[id];
        h.equal(message.mes, h.REPLY, 'the stored reply has no block');
        h.equal(message.swipes[0], h.REPLY, 'the active swipe has no block');
        // (b6-soak-5) Re-rendered once the host has drawn the reply, not at MESSAGE_RECEIVED.
        h.check(!h.mockState.updatedBlocks.some(entry => entry.id === id), 'not re-rendered before the host draws the reply');
        await h.emitAsync('character_message_rendered', id);
        h.check(h.mockState.updatedBlocks.some(entry => entry.id === id && entry.mes === h.REPLY), 'the host re-renders the stripped reply');
        h.equal(h.scannerCalls().length, 0, 'the quick scan made no scanner request');
        h.equal(h.relationshipCalls().length, 0, 'a complete relationship decision needs no focused pass');
        const yunyun = h.npc('Yunyun');
        h.check(yunyun, 'the block admitted Yunyun');
        h.equal(yunyun.present, true, 'present from the block');
        h.equal(yunyun.role, 'adventurer', 'role from the block, not the fallback scanner');
        h.equal(yunyun.species, 'Crimson Demon', 'species from the block');
        h.equal(yunyun.relationship.trust > 0, true, 'grounded relationship delta applied');
        const metrics = h.runtime.scanMetrics();
        h.equal(metrics.label, 'narration-capture', 'the scan is labelled as a capture');
        h.equal(metrics.promptChars, 0, 'no scanner prompt was built');
        h.check(metrics.responseChars > 0, 'the block body is reported as the response');
        const counters = h.status();
        h.equal([counters.requested, counters.used, counters.missing, counters.invalid, counters.unterminated, counters.pending], [1, 1, 0, 0, 0, 0], 'capture counters');
        h.equal(counters.armed, false, 'receipt disarms');
        h.check(!h.asked(), 'the instruction is withdrawn after the reply arrives');

        // A second capture updates the existing dossier, still without a scanner request.
        const second = 'Yunyun now waits at the guild hall, nervously polishing her wand.';
        const update = { npcs: [{ name: 'Yunyun', present: true, location: 'guild hall', relationshipImpact: 'none', relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 } }] };
        const id2 = await h.turn('I go to the guild hall.', `${second}${h.block(update)}`);
        h.equal(h.mockState.context.chat[id2].mes, second);
        h.equal(h.scannerCalls().length, 0, 'the second capture made no scanner request either');
        h.equal(h.relationshipCalls().length, 0, 'no focused relationship pass for a complete no-change decision');
        h.equal(h.runtime.getState().npcs.filter(item => item.name === 'Yunyun').length, 1, 'the existing dossier is updated, not duplicated');
        h.check(/guild hall/i.test(String(h.npc('Yunyun').location || '')), `location from the second block, got ${h.npc('Yunyun').location}`);
        h.equal(h.status().used, 2);
    });
});

test('v1.1.8 receipt withdraws the instruction at once, even when the reply is only a block', () => {
    runScenario('receipt-withdraws', async h => {
        h.settings.narrationCapture = true;
        await h.sendUser('Who is at the gate?');
        await h.generate('normal');
        h.check(h.lastPrompt().includes(h.HEADER), 'armed before the reply');
        h.mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: `${h.REPLY}${h.block()}`, swipe_id: 0, swipes: [`${h.REPLY}${h.block()}`] });
        const id = h.mockState.context.chat.length - 1;
        const pending = Promise.all((h.mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        // Before any asynchronous receipt work runs, the block is gone and so is the instruction.
        h.equal(h.mockState.context.chat[id].mes, h.REPLY, 'stripped synchronously on receipt');
        h.check(!h.asked(), 'the instruction is withdrawn synchronously on receipt');
        h.equal(h.status().armed, false);
        await pending;
        await h.sleep(80);
        h.equal(h.status().used, 1);

        // A reply that is nothing but the block leaves an empty message: the receipt handler returns
        // early, yet the instruction must not linger for a later quiet generation.
        await h.sendUser('Anything else?');
        await h.generate('normal');
        h.check(h.lastPrompt().includes(h.HEADER), 're-armed for the next reply');
        const before = h.scannerCalls().length;
        const emptyId = await h.receiveAssistant(h.block().trim());
        h.equal(h.mockState.context.chat[emptyId].mes, '', 'a block-only reply is stripped to nothing');
        h.check(!h.asked(), 'no instruction remains after a block-only reply');
        await h.generate('quiet');
        h.check(!h.lastPrompt().includes(h.HEADER), 'a later quiet generation carries no instruction');
        h.equal(h.scannerCalls().length, before, 'an empty reply is not scanned');
        h.equal(h.status().used, 1, 'the block of an empty reply is never merged');
        h.equal(h.status().pending, 0, 'the block of an empty reply is not kept');
    });
});

test('v1.1.8 a block in a reply that was not generated under the instruction is stripped and never merged', () => {
    runScenario('unarmed-block', async h => {
        h.settings.narrationCapture = true;
        await h.sendUser('Who is at the gate?');
        // No GENERATION_AFTER_COMMANDS: e.g. /sendas, a card greeting or another extension's message.
        const id = await h.receiveAssistant(`${h.REPLY}${h.block()}`);
        h.equal(h.mockState.context.chat[id].mes, h.REPLY, 'the block is removed from the stored reply');
        h.equal(h.mockState.context.chat[id].swipes[0], h.REPLY);
        h.equal(h.scannerCalls().length, 1, 'the ordinary scanner request runs');
        h.equal(h.npc('Yunyun')?.role, 'scanned adventurer', 'the unarmed block is never merged');
        h.equal(h.runtime.scanMetrics().label, 'automatic');
        h.equal([h.status().requested, h.status().used, h.status().invalid, h.status().pending], [0, 0, 0, 0]);
    });
});

test('v1.1.8 an invalid capture block is stripped and the normal scanner request runs', () => {
    runScenario('invalid-block', async h => {
        h.settings.narrationCapture = true;
        const id = await h.turn('Who is at the gate?', `${h.REPLY}${h.block('{"npcs": [ {"name": "Yunyun", }')}`);
        h.equal(h.mockState.context.chat[id].mes, h.REPLY, 'the broken block is still removed');
        h.equal(h.mockState.context.chat[id].swipes[0], h.REPLY);
        h.equal(h.scannerCalls().length, 1, 'the ordinary scanner request runs');
        h.check(!String(h.scannerCalls()[0].prompt).includes('npc_state_delta'), 'the scanner never sees the block');
        h.check(String(h.scannerCalls()[0].prompt).includes('Yunyun tells Kazuma'), 'the scanner reads the stripped reply');
        h.equal(h.npc('Yunyun')?.role, 'scanned adventurer', 'the dossier comes from the scanner response');
        h.equal(h.runtime.scanMetrics().label, 'automatic');
        h.equal([h.status().used, h.status().invalid, h.status().pending], [0, 1, 0], 'counted as invalid, nothing stored');
    });
});

test('v1.1.8 an unterminated capture block is stripped and the normal scanner request runs', () => {
    runScenario('unterminated-block', async h => {
        h.settings.narrationCapture = true;
        const id = await h.turn('Who is at the gate?', `${h.REPLY}\n\n<!--npc_state_delta\n{"npcs":[{"name":"Yunyun","present":true,"role":"adv`);
        h.equal(h.mockState.context.chat[id].mes, h.REPLY, 'the cut-off block is removed');
        h.equal(h.mockState.context.chat[id].swipes[0], h.REPLY);
        h.equal(h.scannerCalls().length, 1, 'the ordinary scanner request runs');
        h.equal(h.npc('Yunyun')?.role, 'scanned adventurer');
        h.equal([h.status().used, h.status().unterminated, h.status().invalid, h.status().pending], [0, 1, 0, 0]);
    });
});

test('v1.1.8 with capture off a block is still stripped, the scan runs and nothing is injected', () => {
    runScenario('capture-off', async h => {
        h.equal(h.settings.narrationCapture, false, 'the mode defaults to off');
        h.equal(h.status().enabled, false);
        const id = await h.turn('Who is at the gate?', `${h.REPLY}${h.block()}`);
        h.equal(h.mockState.context.chat[id].mes, h.REPLY, 'a stray block never reaches the stored reply');
        h.equal(h.mockState.context.chat[id].swipes[0], h.REPLY);
        h.equal(h.scannerCalls().length, 1, 'the ordinary scanner request runs');
        h.equal(h.npc('Yunyun')?.role, 'scanned adventurer', 'the block is never merged with the mode off');
        h.check(h.dossierPrompts().every(text => !text.includes(h.HEADER)), 'no capture instruction is ever injected');
        h.equal(h.runtime.injectionPreview().captureChars, 0);
        h.equal([h.status().requested, h.status().used, h.status().missing, h.status().invalid, h.status().pending], [0, 0, 0, 0, 0]);
    });
});

test('v1.1.8 Full scan every turn disables capture instructions and capture use', () => {
    runScenario('full-scan', async h => {
        h.settings.narrationCapture = true;
        h.settings.fullScanEveryTurn = true;
        h.equal(h.status().enabled, false, 'capture is not used with Full scan every turn');
        const id = await h.turn('Who is at the gate?', `${h.REPLY}${h.block()}`);
        h.equal(h.mockState.context.chat[id].mes, h.REPLY, 'the block is still stripped');
        h.check(h.dossierPrompts().every(text => !text.includes(h.HEADER)), 'no capture instruction is injected');
        h.equal(h.scannerCalls().length, 1, 'the full scan request runs');
        h.equal(h.runtime.scanMetrics().label, 'automatic-full');
        h.equal(h.npc('Yunyun')?.role, 'scanned adventurer');
        h.equal([h.status().requested, h.status().used, h.status().pending], [0, 0, 0]);
    });
});

test('v1.1.8 a capture merges on the first reply even when Scan every is not due', () => {
    runScenario('scan-every', async h => {
        h.settings.narrationCapture = true;
        h.settings.scanEvery = 3;
        await h.turn('Who is at the gate?', `${h.REPLY}${h.block()}`);
        h.equal(h.npc('Yunyun')?.role, 'adventurer', 'the capture merged on reply 1 of 3');
        h.equal(h.scannerCalls().length, 0, 'no scanner request');
        h.equal(h.status().used, 1);
        h.equal(h.runtime.getState().assistantSinceScan, 0, 'the capture counts as the scan for cadence');
        // Without a block the cadence applies again: reply 1 of 3 does not scan (a pronoun-only reply is quiet).
        await h.turn('We walk on.', 'They walk down the road in silence.');
        h.equal(h.scannerCalls().length, 0, 'an armed reply without a block waits for the cadence');
        h.equal(h.status().missing, 1, 'the missing block is counted');
        h.equal(h.runtime.getState().assistantSinceScan, 1);
    });
});
