import test from 'node:test';
import { runScenario } from './history-replay-wiring.helpers.js';

test('live readers and writers during a catch-up that awaits the model: they see the installed state; a manual edit is kept, the catch-up retries on top of it', () => {
    runScenario('live-during-wait', async h => {
        await h.turn('We meet.', 'Yunyun speaks, mark-1.');
        const chatKey = h.runtime.uiStatus().chatKey;
        const npcId = h.runtime.getState().npcs[0].id;
        h.addReplies(4);
        const installed = JSON.stringify(h.runtime.getDossierState().npcs);
        let release;
        let held = 0;
        h.mockState.holdWhen = async () => { if (!held) { held = 1; await new Promise(resolve => { release = resolve; }); } };
        const catchUp = h.controller();
        catchUp.restored();
        for (let i = 0; i < 100 && !release; i += 1) await h.sleep(10);
        h.check(release, 'the catch-up is waiting for the model');
        // A live read sees the installed state, never the copy (and token counts / injection read the same state).
        h.equal(JSON.stringify(h.runtime.getDossierState().npcs), installed, 'the dossier panel reads the installed state');
        // A manual edit is applied to the live state and saved.
        h.check(await h.runtime.setPortraitSeed(npcId, 4242, { chatKey }) === true, 'the manual edit was accepted');
        await h.runtime.flush();
        h.equal(h.runtime.getState().npcs.find(n => n.id === npcId).portraitSeed, 4242, 'the edit is in the live state');
        release();
        await catchUp.idle();
        // The first try found the live state moved (stale); the retry ran on top of the edit and installed.
        h.equal(catchUp.status().outcome, 'done', 'the retry finished');
        const after = h.runtime.getState();
        h.check(after.npcs.some(n => n.id === npcId), 'the edited dossier is still there');
        h.equal(after.npcs.find(n => n.id === npcId).portraitSeed, 4242, 'the manual edit was not lost');
        h.check(h.mockState.fakeCalls.length > 4, 'the catch-up ran again on top of the edit');
        h.check(after.catchUp === undefined, 'no field left');
        h.check(catchUp.canGenerate() === true, 'sending is back');
    });
});

test('a catch-up whose backfill waits for the host gate: live readers see the installed state, a manual edit is kept (the short await steps aside too)', () => {
    runScenario('live-during-gate', async h => {
        await h.turn('We meet.', 'Yunyun speaks, mark-1.');
        const chatKey = h.runtime.uiStatus().chatKey;
        const npc = h.runtime.getState().npcs[0];
        h.addReplies(4);
        const live = JSON.parse(JSON.stringify(h.runtime.getState()));
        live.pendingBackfills = [{ queueVersion: 1, reason: 'new-admission', npcId: npc.id, label: npc.name, requestedMessageId: null, preserveLiveState: false, silent: true, requestedAt: Date.now(), attempts: 0, lastAttemptAt: 0 }];
        await h.runtime.installState(live);
        const installed = JSON.stringify(h.runtime.getDossierState().npcs);
        let release = null;
        let asked = 0;
        h.runtime.useMessageGate({ refresh: async () => { asked += 1; if (!release) await new Promise(resolve => { release = resolve; }); return null; }, settled: async () => true });
        const catchUp = h.controller();
        catchUp.restored();
        for (let i = 0; i < 200 && !release; i += 1) await h.sleep(10);
        h.check(release, `the catch-up is waiting for the host gate (asked ${asked}, ${JSON.stringify(catchUp.status())}, pending ${JSON.stringify(h.runtime.getState().pendingBackfills)}, calls ${h.mockState.fakeCalls.length})`);
        h.equal(JSON.stringify(h.runtime.getDossierState().npcs), installed, 'live readers see the installed state');
        h.check(await h.runtime.setPortraitSeed(npc.id, 4242, { chatKey }) === true, 'the manual edit was accepted');
        await h.runtime.flush();
        h.equal(h.runtime.getState().npcs.find(n => n.id === npc.id).portraitSeed, 4242, 'the edit is in the live state and saved');
        release();
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'done', 'the catch-up finished on top of the edit');
        h.equal(h.runtime.getState().npcs.find(n => n.id === npc.id).portraitSeed, 4242, 'the manual edit was not lost');
        h.check(catchUp.canGenerate() === true, 'sending is back');
    });
});

test('a publication that fails after a successful install: the catch-up is done, installed, and the publication is retried by the normal path', () => {
    runScenario('publish-fails', async h => {
        h.addReplies(3);
        let retried = 0;
        const catchUp = h.controller({ publish: async () => { throw new Error('the host was busy'); }, retryPublish: () => { retried += 1; } });
        catchUp.restored();
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'done', 'done, not failed');
        h.equal(retried, 1, 'the normal publication path was asked to retry');
        h.check(h.runtime.getState().catchUp === undefined, 'the field is gone (installed)');
        h.check(catchUp.canGenerate() === true, 'sending is back');
    });
});

// (ONEPASSCAPR2-1) A reply whose one-pass block was accepted is rebuilt from that accepted block, not from a model's answer: replay == live.
const capturedParity = async h => {
        h.settings.narrationCapture = true;
        const mockState = h.mockState;
        const block = payload => `\n\n<!--npc_state_delta\n${JSON.stringify(payload)}\n-->`;
        const ZERO = { trust: 0, affection: 0, desire: 0, tension: 0 };
        const scanner = mockState.quietResponder;
        // An accepted admission fill: the backfill answers for the person asked, with a look.
        mockState.quietResponder = async (args = {}) => {
            const asked = (/backfill scanner/i.test(String(args.systemPrompt || '')) ? String(args.prompt || '').match(/^(?:Requested|Target) NPC: (.+?)(?: [(].*)?$/m)?.[1] : undefined);
            return asked ? JSON.stringify({ npcs: [{ name: asked, present: true, ...(asked === 'Sieke' ? { background: 'A clerk at the guild desk.' } : {}), overallAppearance: 'Human woman. Dark hair, wide brown eyes.', relationshipImpact: 'none', relationshipDelta: ZERO }] }) : scanner(args);
        };
        const row = { name: 'Sieke', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'clerk', directInteraction: true, present: true, role: 'Clerk', species: 'Human', gender: 'female',
            memories: ['Registered Astra at the guild desk.'], keyRelationships: 'Sister Temiwa — novice | brings bread', relationshipImpact: 'none', relationshipDelta: ZERO };
        await h.turn('Hello.', `Sieke, a clerk, sits at the guild desk. Sister Temiwa waits.${block({ npcs: [row, { ...row, name: 'Sister Temiwa', memories: [], keyRelationships: [] }], keyRelationshipEdges: [{ from: 'Sieke', to: 'Sister Temiwa', aToB: 'friend', bToA: 'friend' }] })}`);
        await h.turn('Go on.', `Sieke stamps a form.${block({ npcs: [{ name: 'Sieke', present: true, memories: ['Stamped Astra\'s form while the novice watched.'], relationshipImpact: 'none', relationshipDelta: ZERO }] })}`);
        const live = h.stable(h.runtime.getState());
        h.check(live.npcs.find(npc => npc.name === 'Sieke')?.memories?.length >= 2, 'the live run kept both memories');
        h.equal(live.npcs.find(npc => npc.name === 'Sieke')?.background, 'A clerk at the guild desk.', 'the grounded admission follow-up filled background');
        h.check(h.runtime.getState().captureJournal.some(entry => entry.backgroundRule === 1), 'the reply carries the background rule mark');
        const catchUp = h.controller();
        catchUp.rebuild({ replies: null });
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'done', 'the rebuild finished');
        const replayed = h.stable(h.runtime.getState());
        const moved = [];
        for (const key of new Set([...Object.keys(live), ...Object.keys(replayed)])) {
            if (key === 'npcs') for (const npc of live.npcs) { const other = replayed.npcs.find(item => item.id === npc.id) || {}; for (const field of Object.keys(npc)) if (JSON.stringify(npc[field]) !== JSON.stringify(other[field])) moved.push(`${npc.id}.${field}`); }
            else if (JSON.stringify(live[key]) !== JSON.stringify(replayed[key])) moved.push(key);
        }
        if (moved.includes('pendingBackfills')) h.fail(`backfills ${JSON.stringify(live.pendingBackfills)} vs ${JSON.stringify(replayed.pendingBackfills)}`);
        h.equal(moved, [], 'replay of captured replies == the live run (nothing lost)');
};
test('parity: a captured one-pass reply (memory, tie string, edge) replays to the live dossiers; the old reply read again keeps its bytes', () => {
    runScenario('captured-parity', capturedParity);
});

test('hosted (a Story Block v2 host and the adapter loaded): parity: a captured one-pass reply (memory, tie string, edge) replays to the live dossiers; the old reply read again keeps its bytes', () => {
    runScenario('captured-parity-hosted', capturedParity, { hosted: true });
});

// (ONEPASSCAPR2-8) With Full scan every reply on, a deferred full scan of a reply the automatic scan already read is skipped: one read per reply.
test('full scan: a reply the automatic scan covered is not read again by the full scan', () => {
    runScenario('full-scan-once', async h => {
        h.settings.fullScanEveryTurn = true;
        const id = await h.turn('Hello.', 'Yunyun speaks, mark-1.');
        const after = h.scannerCalls().length;
        h.check(after >= 1, 'the reply was read');
        h.equal(h.runtime.getState().lastScannedMessageId, id, 'the marker is on the reply');
        // The second trigger: a branch reconcile asks for a rescan of the latest reply (the chat is unchanged).
        await h.runtime.reconcile({ rescan: true, reason: 'test-reconcile' });
        await h.sleep(300);
        h.equal(h.scannerCalls().length, after, 'no second read of the same, unchanged reply');
    });
});

// (ONEPASSCAPR2-1) The new readings (string ties, folded ids, no ambiguous binding) apply to a reply the SCANNER read live too, so replay reads them the same way;
// a reply with no journal entry (read before the journal existed) is a historical re-read and keeps the old bytes.
const scannerNewShapes = async h => {
        const ZERO = { trust: 0, affection: 0, desire: 0, tension: 0 };
        const row = (name, extra = {}) => ({ name, present: true, role: 'regular', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO, ...extra });
        const prompts = [];
        h.mockState.quietResponder = async (args = {}) => {
            if (!/isolated dossier scanner\./i.test(String(args.systemPrompt || ''))) return '{"npcs":[]}';
            prompts.push(String(args.prompt || ''));
            return JSON.stringify({ npcs: [row('Sister Chris'), row('Sieke', { keyRelationships: 'Sister Chris — novice | brings bread' })], keyRelationshipEdges: [{ from: 'npc_sieke', to: 'npc_sister_chris', aToB: 'friend', bToA: 'friend' }] });
        };
        await h.turn('Hello.', 'Sieke and Sister Chris talk at the desk, mark-1.');
        const live = h.stable(h.runtime.getState());
        h.check(prompts[0].includes('background in npcs[]'), 'the live scan used the new instruction');
        h.check(h.runtime.getState().captureJournal.some(entry => entry.backgroundRule === 1), 'the scanner read has the new rule mark');
        const sieke = live.npcs.find(npc => npc.name === 'Sieke');
        h.check(sieke?.keyRelationships?.some(text => /^Sister Chris — /.test(text)), `the live run read the string tie: ${JSON.stringify(sieke?.keyRelationships)}`);
        const catchUp = h.controller();
        catchUp.rebuild({ replies: null });
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'done', 'the rebuild finished');
        const replayed = h.stable(h.runtime.getState());
        h.equal(replayed.npcs.map(npc => [npc.name, npc.keyRelationships]), live.npcs.map(npc => [npc.name, npc.keyRelationships]), 'replay == live for the new shapes');
        // The same chat as an old save: no journal entry for the reply, so the replay is a historical re-read with the old reading.
        const saved = h.runtime.getState();
        delete saved.captureJournal;
        await h.runtime.installState(saved);
        h.check(!h.runtime.getState().captureJournal?.length, 'the journal is gone, like an old save');
        const beforeOld = prompts.length;
        const old = h.controller();
        old.rebuild({ replies: null });
        await old.idle();
        h.check(prompts.slice(beforeOld).every(prompt => !prompt.includes('background in npcs[]')), 'the old reply uses the old scanner wording');
        h.equal(h.runtime.getState().npcs.find(npc => npc.name === 'Sieke').keyRelationships, [], 'an old reply keeps its old bytes: the string tie is still not read');
};
test('parity: a scanner-read reply with a string tie and an underscore-id edge replays to the live dossier; an old reply (no journal entry) keeps its old reading', () => {
    runScenario('scanner-new-shapes', scannerNewShapes);
});

test('hosted (a Story Block v2 host and the adapter loaded): parity: a scanner-read reply with a string tie and an underscore-id edge replays to the live dossier; an old reply (no journal entry) keeps its old reading', () => {
    runScenario('scanner-new-shapes-hosted', scannerNewShapes, { hosted: true });
});

// A hosted replay (Story Block host + adapter loaded; the adapter is frozen) whose scan admits a new person must finish `done` and keep the dossier:
// the replay's adapter view used to be a Proxy over the frozen adapter, which threw on packNames ("dossier scan failed").
test('hosted replay: a replayed scan that admits a new person finishes done and keeps the dossier; the frozen adapter is read as of the reply', () => {
    runScenario('hosted-replay-admits', async h => {
        const ZERO = { trust: 0, affection: 0, desire: 0, tension: 0 };
        h.mockState.quietResponder = async (args = {}) => {
            if (!/isolated dossier scanner\./i.test(String(args.systemPrompt || ''))) return '{"npcs":[]}';
            return JSON.stringify({ npcs: [{ name: 'Mara', present: true, role: 'regular', identityKind: 'proper_name', dossierSignal: 'high', dossierReason: 'named', directInteraction: true, relationshipImpact: 'none', relationshipDelta: ZERO, personality: 'dry, watchful', about: 'keeps the ferry' }] });
        };
        await h.turn('Hello.', 'Mara keeps the ferry and nods at you.');
        const live = h.stable(h.runtime.getState());
        h.check(live.npcs.some(npc => npc.name === 'Mara'), 'the live scan admitted Mara');
        const catchUp = h.controller();
        catchUp.rebuild({ replies: null });
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'done', 'the hosted replay finished done, not failed');
        const replayed = h.stable(h.runtime.getState());
        h.check(replayed.npcs.some(npc => npc.name === 'Mara'), 'the dossier is kept after the replay');
        h.equal(replayed.npcs.map(npc => npc.name), live.npcs.map(npc => npc.name), 'same people live and replayed');
    }, { hosted: true });
});

test('ONEPASSMISS-1: replay does not invent missing-capture fallbacks for old replies', () => {
    runScenario('no-capture-fallback-on-replay', async h => {
        h.settings.narrationCapture = true;
        h.settings.scanEvery = 10;
        h.addReplies(2);
        const calls = h.scannerCalls().length;
        const catchUp = h.controller();
        catchUp.rebuild({ replies: null });
        await catchUp.idle();
        h.equal(catchUp.status().outcome, 'done', 'rebuild finished');
        h.equal(h.scannerCalls().length, calls, 'quiet historical replies keep their ordinary cadence');
        h.equal(h.runtime.scannerReport().filter(line => line.includes('the reply had no NPC capture')), [], 'replay reports no live fallback');
    });
});
