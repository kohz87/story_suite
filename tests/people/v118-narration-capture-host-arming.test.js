import test from 'node:test';
import { runScenario } from './v118-narration-capture-host.helpers.js';

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
