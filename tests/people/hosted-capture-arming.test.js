// The hosted one-pass instruction (the change lines), through the real event handlers of the synthetic host with a Story Block stub:
// which generations are asked for lines, what withdraws the instruction, and when a stray JSON block is removed from a reply and its swipes.
// Without Story Block nothing is asked for at all (B4-8 removed the JSON block that used to serve that case).
import test from 'node:test';
import { runScenario } from './v118-narration-capture-host.helpers.js';

test('hosted: lines are asked for in fresh replies and continues only; swipe and regenerate keep the rules byte-identical; quiet and impersonate carry none', () => {
    runScenario('hosted-arming', async h => {
        const header = 'NPC CHANGES.';
        const rules = () => String(h.rulesCalls().at(-1)?.[1] ?? '');
        const context = () => String(h.captureCalls().at(-1)?.[1] ?? '');
        h.settings.narrationCapture = true;
        await h.sendUser('Who is at the gate?');
        h.check(rules().startsWith(header), 'the fixed rules are in the system prompt before any generation');
        h.equal(h.status().armed, false, 'nothing is armed before a generation');
        await h.generate('normal');
        h.equal(h.status().armed, true, 'armed after a normal generation');
        h.check(context() !== '', 'the context goes in its own slot');
        const normalRules = rules();
        await h.generate('quiet');
        h.equal(h.status().armed, false, 'quiet disarms');
        h.equal(rules(), '', 'a quiet generation sends no rules');
        for (const type of ['swipe', 'regenerate', 'impersonate']) {
            await h.generate('normal');
            await h.generate(type);
            h.equal(h.status().armed, false, `${type} disarms`);
            h.equal(context(), '', `${type} sends no context`);
            h.equal(rules(), type === 'impersonate' ? '' : normalRules, type === 'impersonate' ? 'impersonate sends no rules' : `${type} keeps the rules byte-identical`);
        }
        for (const type of ['continue', '', undefined]) {
            await h.generate('quiet');
            await h.generate(type);
            h.equal(h.status().armed, true, `${JSON.stringify(type)} arms`);
        }
        await h.generate('normal');
        await h.generate('quiet', true);
        h.equal(h.status().armed, true, 'a dry run changes nothing');
        h.equal(rules(), normalRules);
    }, { hosted: true });
});

test('without Story Block no instruction is sent and nothing is armed', () => {
    runScenario('unhosted-sends-nothing', async h => {
        h.settings.narrationCapture = true;
        await h.sendUser('Who is at the gate?');
        await h.generate('normal');
        h.equal(String(h.rulesCalls().at(-1)?.[1] ?? ''), '', 'no rules');
        h.equal(String(h.captureCalls().at(-1)?.[1] ?? ''), '', 'no context');
        h.check(!h.lastPrompt().includes('NPC CHANGES.') && !h.lastPrompt().includes('NPC STATE DELTA ONE-PASS CAPTURE'), 'neither the lines nor the JSON block are asked for');
        await h.receiveAssistant('The wind crosses the gate.');
        h.equal(h.status().requested, 0, 'a reply is never counted as asked for');
    });
});

test('hosted: receipt withdraws the instruction and strips a stray block; chat change and a stopped generation disarm', () => {
    runScenario('hosted-withdraws', async h => {
        h.settings.narrationCapture = true;
        await h.sendUser('Who is at the gate?');
        await h.generate('normal');
        h.equal(h.status().armed, true, 'armed before the reply');
        h.mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: `${h.REPLY}${h.block()}`, swipe_id: 0, swipes: [`${h.REPLY}${h.block()}`] });
        const id = h.mockState.context.chat.length - 1;
        const pending = Promise.all((h.mockState.listeners.get('message_received') || []).map(fn => fn(id)));
        h.equal(h.mockState.context.chat[id].mes, h.REPLY, 'the stray block is stripped synchronously on receipt');
        h.equal(h.status().armed, false, 'the instruction is withdrawn on receipt');
        await pending;
        h.equal(h.status().used, 0, 'a stray block is never merged');
        h.equal(h.status().pending, 0, 'a stray block is never kept');
        for (const event of ['chat_changed', 'generation_stopped']) {
            await h.sendUser('Anything else?');
            await h.generate('normal');
            h.equal(h.status().armed, true, `armed before ${event}`);
            await h.emitAsync(event);
            h.equal(h.status().armed, false, `${event} disarms`);
        }
    }, { hosted: true });
});

test('hosted: every swipe entry loses a stray block at receipt, leniently only when armed; a swiped-to sibling is stripped before other listeners', () => {
    runScenario('hosted-swipes', async h => {
        h.settings.narrationCapture = true;
        const tagged = 'Tagged.\n<npc_state_delta>{"npcs":[]}</npc_state_delta>';
        const comment = `Yunyun waves.${h.block()}`;
        await h.sendUser('Who is at the gate?');
        await h.generate('normal');
        const armedId = await h.receiveAssistant(`Armed reply.${h.block()}`, { swipes: [tagged, comment, `Armed reply.${h.block()}`], swipeId: 2 });
        h.equal(h.mockState.context.chat[armedId].swipes, ['Tagged.', 'Yunyun waves.', 'Armed reply.'], 'armed: the comment form and the tag form are both removed from every swipe');
        const plainId = await h.receiveAssistant(`Unasked.${h.block()}`, { swipes: [tagged, `Unasked.${h.block()}`], swipeId: 1 });
        h.equal(h.mockState.context.chat[plainId].swipes, [tagged, 'Unasked.'], 'not armed: the tag form stays (strict), the comment form is still removed');
        const message = h.mockState.context.chat[plainId];
        message.swipes = ['A quiet wind.', `Yunyun appears.${h.block()}`, tagged];
        message.swipe_id = 1;
        message.mes = message.swipes[1];
        const listeners = h.mockState.listeners.get('message_swiped') || [];
        h.check(listeners.length >= 2, 'the strip and the reconcile listeners are both registered');
        listeners[0](plainId);
        h.equal(message.mes, 'Yunyun appears.', 'the swiped-to text is stripped by the first listener');
        h.equal(message.swipes, ['A quiet wind.', 'Yunyun appears.', tagged], 'every stored swipe loses its comment block; the tag form stays');
    }, { hosted: true, makeFirst: true });
});

test('hosted: the stray block is removed before earlier-registered listeners run, and a dossier change between prompt and reply makes the reply outdated', () => {
    runScenario('hosted-order-outdated', async h => {
        h.settings.narrationCapture = true;
        await h.sendUser('Who is at the gate?');
        await h.generate('normal');
        // The player adds a dossier while the reply is being generated.
        await h.manualAddNpc('Wiz');
        const id = await h.receiveAssistant(`${h.REPLY}${h.block()}`);
        h.equal(h.mockState.earlierListenerSaw.at(-1), h.REPLY, 'an earlier-registered listener saw the stripped text');
        h.equal(h.mockState.context.chat[id].mes, h.REPLY, 'the stray block is stripped');
        h.equal([h.status().requested, h.status().outdated, h.status().used, h.status().pending], [0, 1, 0, 0], 'counted as outdated, never stored');
        await h.sendUser('And then?');
        await h.generate('normal');
        await h.receiveAssistant(`${h.REPLY} Again.`);
        h.equal([h.status().requested, h.status().outdated], [1, 1], 'without an intervening write the next reply is current again');
    }, { hosted: true, makeFirst: true });
});
