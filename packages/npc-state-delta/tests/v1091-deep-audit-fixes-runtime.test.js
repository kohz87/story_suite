import test from 'node:test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function deepAuditRuntimeChecks(mockState, eventSource, manualAddNpc, sleep, urls) {
    const runtime = globalThis.NPCStateDelta;
    const warnings = [];
    const successes = [];
    const errors = [];
    const previousToastr = { ...globalThis.toastr };
    globalThis.toastr.warning = message => warnings.push(String(message));
    globalThis.toastr.success = message => successes.push(String(message));
    globalThis.toastr.error = message => errors.push(String(message));
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
    const waitUntil = async (predicate, label) => {
        for (let i = 0; i < 400; i++) { if (predicate()) return; await sleep(5); }
        fail(`deep audit runtime check did not settle: ${label}`);
    };
    const remoteAdvance = mutate => {
        const pointer = runtime.dataFile();
        const payload = JSON.parse(mockState.files.get(pointer.path));
        mutate(payload.state);
        payload.revision += 1;
        payload.writerId = 'remote-other-session';
        mockState.files.set(pointer.path, JSON.stringify(payload));
    };
    const settings = mockState.extensionSettings.npc_state_delta;

    // RB87-03: a new local turn on a stale chat does not certify the old history.
    await open('rb87-stale', ['Mira waits by the gate.', 'Mira watches the road.']);
    await manualAddNpc('Mira Stale');
    await runtime.flush();
    remoteAdvance(state => {
        state.lineage = [...state.lineage, 'remote-message-3', 'remote-message-4'];
        state.npcs.find(npc => npc.name === 'Mira Stale').mood = 'delighted';
    });
    await runtime.ensureFresh({ reason: 'rb87-remote-advance' });
    mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: 'A different local turn.' });
    eventSource.emit('message_sent', mockState.context.chat.length - 1);
    await sleep(150);
    if (runtime.getState().lineage.length !== 4) fail(`RB87-03: a local turn replaced the adopted lineage (${runtime.getState().lineage.length})`);
    mockState.context.chat.push({ is_user: false, is_system: false, name: 'Narrator', mes: 'A local reply.', swipe_id: 0 });
    const rawBeforeStale = mockState.rawCalls.length;
    if (await runtime.scan() !== false) fail('RB87-03: a scan ran on the stale chat after a local turn');
    if (mockState.rawCalls.length !== rawBeforeStale) fail('RB87-03: the stale scan dispatched a request');
    if (runtime.getState().npcs.find(npc => npc.name === 'Mira Stale').mood !== 'delighted') fail('RB87-03: the adopted mood was overwritten');
    eventSource.emit('chat_changed');
    await sleep(300);

    // RB87-04: Refresh rejects a sole returned row that names someone else.
    await open('rb87-refresh', ['Mira Deep greets you. Noela has died elsewhere.', 'Mira Deep, the records clerk of the old quarter, nods.']);
    await manualAddNpc('Mira Deep');
    await runtime.flush();
    const miraId = runtime.getState().npcs.find(npc => npc.name === 'Mira Deep').id;
    mockState.quietResponder = async () => JSON.stringify({ npcs: [{ id: 'npc_noela_wrong', name: 'Noela', lifeState: 'deceased', lifeStateCertainty: 'explicit', lifeStateReason: 'Noela has died elsewhere', background: 'travelling merchant' }] });
    await runtime.refreshFromChat(miraId);
    if (runtime.getNpc(miraId).lifeState === 'deceased') fail('RB87-04: another NPC\'s death was applied to the Refresh target');
    mockState.quietResponder = async () => JSON.stringify({ npcs: [{ name: 'Mira Deep Vale', background: 'records clerk of the old quarter' }] });
    await runtime.refreshFromChat(miraId);
    if (!/records clerk/.test(runtime.getNpc(miraId).background || '')) fail('RB87-04: an expanded target name was rejected');
    mockState.quietResponder = null;

    // RB87-16: Cancel during Save's freshness wait abandons the draft.
    await open('rb87-cancel', ['Sela Cancel tends herbs.', 'Sela Cancel hums.']);
    await manualAddNpc('Sela Cancel');
    await runtime.flush();
    const sela = runtime.getState().npcs.find(npc => npc.name === 'Sela Cancel');
    const originalRole = sela.role || '';
    const previousGetElementById = document.getElementById;
    await runtime.openEditor(sela.id);
    await sleep(30);
    const popup = mockState.popupCalls.at(-1);
    const values = new Map();
    const editorHtml = String(popup.content?.innerHTML ?? popup.content ?? '');
    for (const match of editorHtml.matchAll(/id="(npc_state_delta_edit_[a-z_]+)"([^>]*)>/g)) {
        const attrs = match[2];
        values.set(match[1], { value: (attrs.match(/value="([^"]*)"/) || [])[1] ?? '', checked: /\bchecked\b/.test(attrs) });
    }
    for (const match of editorHtml.matchAll(/id="(npc_state_delta_edit_[a-z_]+)"[^>]*>([^<]*)<\/textarea>/g)) values.set(match[1], { value: match[2], checked: false });
    if (values.size < 10) fail(`RB87-16: the editor inputs were not found (${values.size})`);
    values.set('npc_state_delta_edit_role', { value: 'Canceled alchemist draft', checked: false });
    document.getElementById = id => values.get(id) || null;
    let releaseRead;
    let markEntered;
    const entered = new Promise(resolve => { markEntered = resolve; });
    mockState.readBarrier = { entered: markEntered, promise: new Promise(resolve => { releaseRead = resolve; }) };
    const saving = popup.complete(1);
    await entered;
    await popup.complete(null);
    releaseRead();
    await saving;
    await sleep(100);
    document.getElementById = previousGetElementById || (() => null);
    if (runtime.getNpc(sela.id).role !== originalRole) fail(`RB87-16: a cancelled Save applied its draft (${runtime.getNpc(sela.id).role})`);
    // Control: an uncancelled Save of the same kind of draft applies.
    await runtime.openEditor(sela.id);
    await sleep(30);
    const saved = mockState.popupCalls.at(-1);
    const savedValues = new Map();
    const savedHtml = String(saved.content?.innerHTML ?? saved.content ?? '');
    for (const match of savedHtml.matchAll(/id="(npc_state_delta_edit_[a-z_]+)"([^>]*)>/g)) {
        savedValues.set(match[1], { value: (match[2].match(/value="([^"]*)"/) || [])[1] ?? '', checked: /\bchecked\b/.test(match[2]) });
    }
    for (const match of savedHtml.matchAll(/id="(npc_state_delta_edit_[a-z_]+)"[^>]*>([^<]*)<\/textarea>/g)) savedValues.set(match[1], { value: match[2], checked: false });
    savedValues.set('npc_state_delta_edit_role', { value: 'Kept herbalist draft', checked: false });
    document.getElementById = id => savedValues.get(id) || null;
    await saved.complete(1);
    await sleep(100);
    document.getElementById = previousGetElementById || (() => null);
    if (runtime.getNpc(sela.id).role !== 'Kept herbalist draft') fail(`RB87-16 control: an ordinary Save did not apply (${runtime.getNpc(sela.id).role}; ${warnings.slice(-1)})`);

    // RB87-17: an export requested in one chat does not download another.
    await open('rb87-export-a', ['Only A is here.', 'Only A waits.']);
    await manualAddNpc('Only A');
    await runtime.flush();
    // dossier-tools is normally loaded by the bootstrap; give its style/download DOM calls stubs.
    const previousHead = document.head;
    const previousBody = document.body;
    const previousCreateElement = document.createElement;
    document.head = previousHead || { appendChild() {} };
    document.body = previousBody || {};
    const previousBodyAppend = document.body.appendChild;
    document.body.appendChild = previousBodyAppend || (() => {});
    document.createElement = tag => ({ tagName: String(tag).toUpperCase(), style: {}, dataset: {}, click() {}, remove() {}, setAttribute() {}, append() {}, appendChild() {} });
    const { exportNativeTools } = await import(urls.dossierTools);
    const previousCreateObjectURL = URL.createObjectURL;
    let downloads = 0;
    URL.createObjectURL = () => { downloads += 1; return 'blob:synthetic-export'; };
    let releaseExport;
    let exportEntered;
    const exportGate = new Promise(resolve => { exportEntered = resolve; });
    mockState.readBarrier = { entered: exportEntered, promise: new Promise(resolve => { releaseExport = resolve; }) };
    const exporting = exportNativeTools();
    await exportGate;
    mockState.context.chatId = 'rb87-export-b';
    mockState.context.chat = [{ is_user: true, is_system: false, name: 'Kazuma', mes: 'Only B is here.' }];
    eventSource.emit('chat_changed');
    releaseExport();
    await exporting;
    await sleep(150);
    URL.createObjectURL = previousCreateObjectURL;
    document.createElement = previousCreateElement;
    document.body.appendChild = previousBodyAppend;
    if (!previousBody) delete document.body;
    if (!previousHead) delete document.head;
    if (downloads !== 0) fail('RB87-17: an export downloaded after the chat changed');

    // RB87-18: a full cast scan whose provider requests all fail does not report success.
    await open('rb87-fullcast', ['I look for Tarn Full.', 'Tarn Full waves from the counter.']);
    await manualAddNpc('Tarn Full');
    await runtime.flush();
    mockState.quietResponder = async () => { throw new Error('provider unavailable'); };
    const { runFullCastScan } = await import(urls.fullCast);
    successes.length = 0;
    const fullCast = await runFullCastScan(mockState.context.chat.length - 1, null, { manual: true });
    mockState.quietResponder = null;
    if (fullCast !== false) fail('RB87-18: a failed full cast scan returned success');
    if (successes.some(message => /full cast scan|full-scanned/i.test(message))) fail('RB87-18: a failed full cast scan announced success');

    // RB87-02: an uncertain chat-deletion retirement keeps and registers its recovery copy.
    await open('rb87-delete-chat', ['Oda Delete sweeps.', 'Oda Delete leans on the broom.']);
    await manualAddNpc('Oda Delete');
    await runtime.flush();
    const deleteKey = runtime.uiStatus().chatKey;
    const deletePath = runtime.dataFile().path;
    let retiredDelete = false;
    globalThis.fetch = async (url, options = {}) => {
        if (url === '/api/files/upload') {
            const body = JSON.parse(options.body || '{}');
            const text = Buffer.from(body.data, 'base64').toString('utf8');
            const response = await baseFetch(url, options);
            if (`/user/files/${body.name}` === deletePath && /"retired":\s*true/.test(text)) retiredDelete = true;
            return response;
        }
        if (url === deletePath && retiredDelete) return { ok: false, status: 403, text: async () => 'forbidden' };
        return baseFetch(url, options);
    };
    for (const listener of mockState.listeners.get('chat_deleted') || []) {
        try { await listener('rb87-delete-chat'); } catch { /* the uncertain deletion reports failure */ }
    }
    await sleep(300);
    globalThis.fetch = baseFetch;
    if (!retiredDelete) fail('RB87-02: the scenario did not reach source retirement');
    const recovery = settings.recoveryFiles?.[deleteKey];
    if (!recovery?.path || !mockState.files.has(recovery.path)) fail('RB87-02: the chat-deletion recovery copy was not kept and registered');

    // RB87-01: a lost retirement acknowledgement keeps the renamed dossier recoverable.
    await open('rb87-rename', ['Pell Lost counts coins.', 'Pell Lost smiles.']);
    await manualAddNpc('Pell Lost');
    await runtime.flush();
    const oldKey = runtime.uiStatus().chatKey;
    const oldOwner = oldKey.split(':')[1];
    const oldPath = runtime.dataFile().path;
    mockState.context.eventTypes.CHARACTER_RENAMED = 'character_renamed';
    const { prepareNpcStateHardening } = await import(urls.hardening);
    await prepareNpcStateHardening();
    let retiredRename = false;
    globalThis.fetch = async (url, options = {}) => {
        if (url === '/api/files/upload') {
            const body = JSON.parse(options.body || '{}');
            const text = Buffer.from(body.data, 'base64').toString('utf8');
            const response = await baseFetch(url, options);
            if (`/user/files/${body.name}` === oldPath && /"retired":\s*true/.test(text)) {
                retiredRename = true;
                throw new TypeError('network connection lost after the write');
            }
            return response;
        }
        return baseFetch(url, options);
    };
    for (const listener of mockState.listeners.get('character_renamed') || []) {
        try { await listener(oldOwner, `renamed-${oldOwner}`); } catch { /* the partial rename reports failure */ }
    }
    globalThis.fetch = baseFetch;
    if (!retiredRename) fail('RB87-01: the scenario did not reach source retirement');
    const survivors = [...mockState.files.entries()].filter(([filePath, text]) => filePath !== oldPath && /Pell Lost/.test(text));
    if (!survivors.length) fail('RB87-01: every durable copy of the dossier was deleted');
    if (!settings.recoveryFiles?.[oldKey]?.path) fail('RB87-01: the recovery copy was not registered');

    Object.assign(globalThis.toastr, previousToastr);
    setTimeout(() => process.exit(0), 1500);
}

test('RB87-01/02/03/04/16/17/18 run through the synthetic host', () => {
    let source = fs.readFileSync(new URL('./runtime-smoke.mjs', import.meta.url), 'utf8');
    source = source.replace('const here = path.dirname(fileURLToPath(import.meta.url));', `const here = ${JSON.stringify(fileURLToPath(new URL('.', import.meta.url)))};`);
    const marker = "    console.log('Runtime smoke:";
    if (!source.includes(marker)) throw new Error('Runtime smoke cleanup marker changed');
    // Module URLs are built inside the harness, which copies the extension into its synthetic host tree.
    const urls = "{ hardening: pathToFileURL(path.join(extRoot, 'hardening.js')).href, fullCast: pathToFileURL(path.join(extRoot, 'full-cast.js')).href, dossierTools: pathToFileURL(path.join(extRoot, 'dossier-tools.js')).href }";
    source = source.replace(marker, `    await (${deepAuditRuntimeChecks.toString()})(mockState, eventSource, manualAddNpc, sleep, ${urls});\n${marker}`);
    execFileSync(process.execPath, ['--import', new URL('./active-runtime-test-setup.mjs', import.meta.url).href, '--input-type=module'], {
        input: source,
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 16 * 1024 * 1024,
    });
});
