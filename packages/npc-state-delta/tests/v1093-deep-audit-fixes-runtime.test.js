import test from 'node:test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function deepAuditRuntimeChecks(mockState, eventSource, manualAddNpc, sleep, urls) {
    const runtime = globalThis.NPCStateDelta;
    const warnings = [];
    const previousToastr = { ...globalThis.toastr };
    globalThis.toastr.warning = message => warnings.push(String(message));
    const baseFetch = globalThis.fetch;
    const fail = message => { throw new Error(message); };
    const open = async (id, lines) => {
        mockState.context.groupId = null;
        mockState.context.chatId = id;
        mockState.context.getCurrentChatId = () => mockState.context.chatId;
        mockState.context.chat = lines.map((mes, i) => ({ is_user: i % 2 === 0, is_system: false, name: i % 2 === 0 ? 'Kazuma' : 'Narrator', mes }));
        eventSource.emit('chat_changed');
        await sleep(150);
    };
    const remoteAdvance = mutate => {
        const pointer = runtime.dataFile();
        const payload = JSON.parse(mockState.files.get(pointer.path));
        mutate(payload.state, payload);
        payload.revision += 1;
        payload.writerId = 'remote-other-session';
        mockState.files.set(pointer.path, JSON.stringify(payload));
    };
    const settings = mockState.extensionSettings.npc_state_delta;

    // RB92-01: sending re-checks the server, so a newer dossier is adopted before the local turn.
    await open('rb92-send', ['Mira waits by the gate.', 'Mira watches the road.']);
    await manualAddNpc('Mira Send');
    await runtime.flush();
    remoteAdvance(state => {
        state.lineage = [...state.lineage, 'remote-message-3', 'remote-message-4'];
        state.npcs.find(npc => npc.name === 'Mira Send').mood = 'delighted';
    });
    mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'A local turn.' });
    for (const listener of mockState.listeners.get('message_sent') || []) await listener(mockState.context.chat.length - 1);
    if (runtime.getState().npcs.find(npc => npc.name === 'Mira Send')?.mood !== 'delighted') fail('RB92-01: the newer dossier was not adopted before generation');
    if (runtime.getState().lineage.length !== 4) fail('RB92-01: the local turn replaced the adopted lineage');
    eventSource.emit('chat_changed');
    await sleep(300);

    // RB92-02: a retirement observed by this session keeps the open chat blocked on retry.
    await open('rb92-retired', ['Mara Valen counts coins.', 'Mara Valen smiles.']);
    await manualAddNpc('Mara Valen');
    await runtime.flush();
    remoteAdvance((state, payload) => { payload.retired = true; payload.retiredAt = new Date().toISOString(); payload.retireReason = 'chat-deleted'; payload.state = {}; });
    const rawBeforeRetired = mockState.rawCalls.length;
    // Both attempts are refused (the first observes the retirement, the retry must not reuse it).
    await runtime.scan().catch(() => false);
    await runtime.scan().catch(() => false);
    await sleep(100);
    if (mockState.rawCalls.length !== rawBeforeRetired) fail('RB92-02: a retried scan dispatched on a retired chat');
    if (/Mara Valen/.test(mockState.files.get(runtime.dataFile()?.path || '') || '')) fail('RB92-02: the retired dossier was revived');

    // RB92-03: an earlier permissive match cannot give another NPC's death to the target.
    await open('rb92-target', ['Mira Deep greets you. Noela has died elsewhere.', 'Mira Deep nods.']);
    await manualAddNpc('Mira Deep');
    await manualAddNpc('Mira Vale');
    await runtime.flush();
    const miraId = runtime.getState().npcs.find(npc => npc.name === 'Mira Deep').id;
    for (const row of [
        { id: miraId, name: 'Noela', lifeState: 'deceased', lifeStateCertainty: 'explicit', lifeStateReason: 'Noela has died elsewhere' },
        { name: 'Noela', role: 'Assistant to Mira Deep', lifeState: 'deceased', lifeStateCertainty: 'explicit', lifeStateReason: 'Noela has died elsewhere' },
        { name: 'Mira Vale', lifeState: 'deceased', lifeStateCertainty: 'explicit', lifeStateReason: 'Mira Vale fell' },
    ]) {
        mockState.quietResponder = async () => JSON.stringify({ npcs: [row] });
        await runtime.refreshFromChat(miraId);
        if (runtime.getNpc(miraId).lifeState === 'deceased') fail(`RB92-03: a contradicting row was applied (${row.name})`);
    }
    mockState.quietResponder = null;

    // RB92-04: an edit during Refresh's final freshness read discards the obsolete result.
    await open('rb92-final', ['What happened to Ilse Final?', 'Ilse Final died in the warehouse fire.']);
    await manualAddNpc('Ilse Final');
    await runtime.flush();
    const ilseId = runtime.getState().npcs.find(npc => npc.name === 'Ilse Final').id;
    const sidecarPath = runtime.dataFile().path;
    let armed = false;
    let reads = 0;
    let releaseFinal;
    let finalEntered;
    const finalGate = new Promise(resolve => { finalEntered = resolve; });
    globalThis.fetch = async (url, options = {}) => {
        if (armed && url === sidecarPath && (options.method || 'GET') === 'GET') {
            reads += 1;
            if (reads === 2) { finalEntered(); await new Promise(resolve => { releaseFinal = resolve; }); }
        }
        return baseFetch(url, options);
    };
    mockState.quietResponder = async () => {
        armed = true;
        return JSON.stringify({ npcs: [{ id: ilseId, name: 'Ilse Final', lifeState: 'deceased', lifeStateCertainty: 'explicit', lifeStateReason: 'Died in the warehouse fire' }] });
    };
    const finalRefresh = runtime.refreshFromChat(ilseId);
    await finalGate;
    // Later scans of the edited history see her alive.
    mockState.quietResponder = async () => JSON.stringify({ npcs: [{ id: ilseId, name: 'Ilse Final', lifeState: 'alive', present: false }] });
    mockState.context.chat[mockState.context.chat.length - 1].mes = 'Ilse Final survives the warehouse fire, alive and unharmed.';
    eventSource.emit('message_edited', mockState.context.chat.length - 1);
    await sleep(50);
    releaseFinal();
    if (await finalRefresh !== false) fail('RB92-04: Refresh committed after its source was edited during the final read');
    await sleep(300);
    globalThis.fetch = baseFetch;
    mockState.quietResponder = null;
    if (runtime.getNpc(ilseId).lifeState === 'deceased') fail('RB92-04: an obsolete death was saved against the edited survival history');

    // RB92-15: a single-target backfill changes only its target in every result channel.
    await open('rb92-backfill', ['Mira Scope and Noela Scope meet Kora Scope.', 'Mira Scope waves.']);
    await manualAddNpc('Mira Scope');
    await manualAddNpc('Noela Scope');
    await manualAddNpc('Kora Scope');
    await runtime.flush();
    const scope = name => runtime.getState().npcs.find(npc => npc.name === name);
    const noelaSpeechBefore = scope('Noela Scope').speech || '';
    mockState.quietResponder = async () => JSON.stringify({
        npcs: [{ id: scope('Mira Scope').id, name: 'Mira Scope', mood: 'cheerful' }],
        profileUpdates: [{ id: scope('Noela Scope').id, speechState: 'refine', speech: 'Speaks in grand rhymes.', evidence: { speech: [] } }],
        keyRelationshipEdges: [{ aId: scope('Noela Scope').id, a: 'Noela Scope', bId: scope('Kora Scope').id, b: 'Kora Scope', aToB: 'friend', bToA: 'friend', reason: 'they meet' }],
    });
    await runtime.scanDossier(scope('Mira Scope').id);
    await sleep(200);
    mockState.quietResponder = null;
    if ((scope('Noela Scope').speech || '') !== noelaSpeechBefore) fail('RB92-15: backfill changed another NPC\'s Speech');
    if ((runtime.getState().socialGraph?.edges || []).some(edge => [edge.aId, edge.bId].includes(scope('Noela Scope').id) && [edge.aId, edge.bId].includes(scope('Kora Scope').id))) fail('RB92-15: backfill created a bond between two other NPCs');

    // RB92-14: Refresh does not restore a summary the canonical gate rejected.
    await open('rb92-summary', ['Tess Ward keeps a professional distance.', 'Tess Ward nods.']);
    await manualAddNpc('Tess Ward');
    await runtime.flush();
    const tessId = runtime.getState().npcs.find(npc => npc.name === 'Tess Ward').id;
    mockState.quietResponder = async () => JSON.stringify({ npcs: [{ id: tessId, name: 'Tess Ward', relationshipSummary: 'Feels she must repay him and will follow him anywhere.', mood: 'quiet' }] });
    await runtime.refreshFromChat(tessId);
    mockState.quietResponder = null;
    if (/must repay|follow him anywhere/.test(runtime.getNpc(tessId).relationshipSummary || '')) fail('RB92-14: Refresh stored a rejected summary');

    // RB92-22: Refresh's implicit editor save honours a cancelled popup.
    await open('rb92-implicit', ['Sela Implicit tends herbs.', 'Sela Implicit hums.']);
    await manualAddNpc('Sela Implicit');
    await runtime.flush();
    const sela = runtime.getState().npcs.find(npc => npc.name === 'Sela Implicit');
    const originalRole = sela.role || '';
    const previousGetElementById = document.getElementById;
    await runtime.openEditor(sela.id);
    await sleep(30);
    const popup = mockState.popupCalls.at(-1);
    const editorHtml = String(popup.content?.innerHTML ?? popup.content ?? '');
    const values = new Map();
    for (const match of editorHtml.matchAll(/id="(npc_state_delta_edit_[a-z_]+)"([^>]*)>/g)) {
        values.set(match[1], { value: (match[2].match(/value="([^"]*)"/) || [])[1] ?? '', checked: /\bchecked\b/.test(match[2]) });
    }
    for (const match of editorHtml.matchAll(/id="(npc_state_delta_edit_[a-z_]+)"[^>]*>([^<]*)<\/textarea>/g)) values.set(match[1], { value: match[2], checked: false });
    values.set('npc_state_delta_edit_role', { value: 'Canceled Refresh alchemist draft', checked: false });
    document.getElementById = id => values.get(id) || null;
    let releaseRead;
    let markEntered;
    const entered = new Promise(resolve => { markEntered = resolve; });
    mockState.readBarrier = { entered: markEntered, promise: new Promise(resolve => { releaseRead = resolve; }) };
    mockState.quietResponder = async () => '{"npcs":[]}';
    const refreshing = runtime.refreshFromChat(sela.id);
    await entered;
    popup.result = null;   // host Popup sets the result before its closing animation; onClose comes later
    releaseRead();
    const refreshResult = await refreshing;
    await sleep(100);
    document.getElementById = previousGetElementById || (() => null);
    mockState.quietResponder = null;
    if (runtime.getNpc(sela.id).role !== originalRole) fail(`RB92-22: the cancelled implicit save applied (${runtime.getNpc(sela.id).role})`);
    if (refreshResult !== false) fail('RB92-22: Refresh continued after the editor was cancelled');
    await popup.complete(null);

    // RB92-23: Full Cast scans an unscanned greeting at message 0.
    mockState.context.groupId = null;
    mockState.context.chatId = 'rb92-greeting';
    mockState.context.getCurrentChatId = () => mockState.context.chatId;
    mockState.context.chat = [{ is_user: false, is_system: false, name: 'Narrator', mes: 'Mira Greet waves from the counter.' }];
    eventSource.emit('chat_changed');
    await sleep(150);
    const { runFullCastScan } = await import(urls.fullCast);
    const rawBeforeGreeting = mockState.rawCalls.length;
    mockState.quietResponder = async () => '{"npcs":[]}';
    await runFullCastScan(0, null, { manual: true });
    mockState.quietResponder = null;
    if (mockState.rawCalls.length === rawBeforeGreeting) fail('RB92-23: Full Cast skipped the unscanned greeting at message 0');

    // RB92-05: an uncertain rename retirement resumes on retry.
    await open('rb92-rename', ['Pell Resume counts coins.', 'Pell Resume smiles.']);
    await manualAddNpc('Pell Resume');
    await runtime.flush();
    const oldKey = runtime.uiStatus().chatKey;
    const oldOwner = oldKey.split(':')[1];
    const oldPath = runtime.dataFile().path;
    eventSource.emit('chat_changed');
    mockState.context.chatId = 'rb92-other';
    mockState.context.chat = [{ is_user: false, is_system: false, name: 'Narrator', mes: 'Elsewhere.' }];
    eventSource.emit('chat_changed');
    await sleep(150);
    mockState.context.eventTypes.CHARACTER_RENAMED = 'character_renamed';
    const { prepareNpcStateHardening } = await import(urls.hardening);
    await prepareNpcStateHardening();
    let failOnce = true;
    globalThis.fetch = async (url, options = {}) => {
        if (url === '/api/files/upload' && failOnce) {
            const body = JSON.parse(options.body || '{}');
            const text = Buffer.from(body.data, 'base64').toString('utf8');
            if (`/user/files/${body.name}` === oldPath && /"retired":\s*true/.test(text)) {
                failOnce = false;
                await baseFetch(url, options);
                throw new TypeError('network connection lost after the write');
            }
        }
        return baseFetch(url, options);
    };
    const renameTo = `renamed-${oldOwner}`;
    for (const listener of mockState.listeners.get('character_renamed') || []) {
        try { await listener(oldOwner, renameTo); } catch { /* the uncertain first attempt reports failure */ }
    }
    if (!settings.pendingRenames?.[oldKey]) fail('RB92-05: the uncertain rename left no resumable record');
    for (const listener of mockState.listeners.get('character_renamed') || []) {
        try { await listener(oldOwner, renameTo); } catch (error) { fail(`RB92-05: the retry failed: ${error?.message || error}`); }
    }
    globalThis.fetch = baseFetch;
    const newKey = oldKey.replace(`:${oldOwner}:`, `:${renameTo}:`);
    if (!settings.dataFiles?.[newKey]?.path) fail('RB92-05: the retry did not publish the renamed dossier');
    if (settings.pendingRenames?.[oldKey]) fail('RB92-05: the resumable record was not cleared');

    Object.assign(globalThis.toastr, previousToastr);
    setTimeout(() => process.exit(0), 1500);
}

test('RB92-01/02/03/04/05/14/15/22/23 run through the synthetic host', () => {
    let source = fs.readFileSync(new URL('./runtime-smoke.mjs', import.meta.url), 'utf8');
    source = source.replace('const here = path.dirname(fileURLToPath(import.meta.url));', `const here = ${JSON.stringify(fileURLToPath(new URL('.', import.meta.url)))};`);
    const marker = "    console.log('Runtime smoke:";
    if (!source.includes(marker)) throw new Error('Runtime smoke cleanup marker changed');
    // Module URLs are built inside the harness, which copies the extension into its synthetic host tree.
    const urls = "{ hardening: pathToFileURL(path.join(extRoot, 'hardening.js')).href, fullCast: pathToFileURL(path.join(extRoot, 'full-cast.js')).href }";
    source = source.replace(marker, `    await (${deepAuditRuntimeChecks.toString()})(mockState, eventSource, manualAddNpc, sleep, ${urls});\n${marker}`);
    execFileSync(process.execPath, ['--import', new URL('./active-runtime-test-setup.mjs', import.meta.url).href, '--input-type=module'], {
        input: source,
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 16 * 1024 * 1024,
    });
});
