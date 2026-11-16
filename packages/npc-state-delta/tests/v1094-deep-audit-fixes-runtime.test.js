import test from 'node:test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function deepAuditRuntimeChecks(mockState, eventSource, manualAddNpc, sleep, urls) {
    const runtime = globalThis.NPCStateDelta;
    const baseFetch = globalThis.fetch;
    const fail = message => { throw new Error(message); };
    const settings = mockState.extensionSettings.npc_state_delta;
    const open = async (id, lines) => {
        mockState.context.groupId = null;
        mockState.context.chatId = id;
        mockState.context.getCurrentChatId = () => mockState.context.chatId;
        mockState.context.chat = lines.map((mes, i) => ({ is_user: i % 2 === 0, is_system: false, name: i % 2 === 0 ? 'Kazuma' : 'Narrator', mes }));
        eventSource.emit('chat_changed');
        await sleep(150);
    };
    const remoteAdvance = (mutate, path = runtime.dataFile().path) => {
        const payload = JSON.parse(mockState.files.get(path));
        mutate(payload.state, payload);
        payload.revision += 1;
        payload.writerId = 'remote-other-session';
        mockState.files.set(path, JSON.stringify(payload));
    };
    const retire = path => remoteAdvance((state, payload) => { payload.retired = true; payload.retiredAt = new Date().toISOString(); payload.retireReason = 'chat-deleted'; payload.state = {}; }, path);
    const named = name => runtime.getState().npcs.find(npc => npc.name === name);
    const liveFileMentions = text => [...mockState.files.values()].some(raw => {
        try { const payload = JSON.parse(raw); return payload?.retired !== true && JSON.stringify(payload).includes(text); } catch { return false; }
    });
    const { prepareNpcStateHardening } = await import(urls.hardening);
    mockState.context.eventTypes.CHARACTER_RENAMED = 'character_renamed';
    await prepareNpcStateHardening();

    // RB93-02: dirty local work never republishes a sidecar observed as retired (flush, owner rename).
    for (const route of ['flush', 'rename']) {
        await open(`rb93-retired-${route}`, ['Mara Valen counts coins.', 'Mara Valen smiles.']);
        await manualAddNpc('Mara Valen');
        await runtime.flush();
        const path = runtime.dataFile().path;
        const owner = runtime.uiStatus().chatKey.split(':')[1];
        globalThis.fetch = async (url, options = {}) => (url === '/api/files/upload'
            ? { ok: false, status: 400, json: async () => ({}), text: async () => 'bad request' }
            : baseFetch(url, options));
        await manualAddNpc(`Local Unsaved ${route}`);
        await runtime.flush().catch(() => null);
        await sleep(50);
        globalThis.fetch = baseFetch;
        retire(path);
        await runtime.ensureFresh().catch(() => null);
        if (runtime.uiStatus().hydrationStatus !== 'error') fail(`RB93-02 (${route}): the retirement was not observed`);
        if (route === 'flush') await runtime.flush().catch(() => null);
        else for (const listener of mockState.listeners.get('character_renamed') || []) await Promise.resolve(listener(owner, `${owner}-renamed`)).catch(() => null);
        await sleep(100);
        if (!/"retired":\s*true/.test(mockState.files.get(path) || '')) fail(`RB93-02 (${route}): the retired sidecar was overwritten`);
        if (liveFileMentions(`Local Unsaved ${route}`)) fail(`RB93-02 (${route}): retired local work was published`);
    }

    // RB93-03: regenerate/swipe/continue revalidate the dossier before the prompt is built.
    await open('rb93-generation', ['Mira Voice hums at the bar.', 'Mira Voice keeps humming.']);
    await manualAddNpc('Mira Voice');
    await runtime.flush();
    for (const [type, speech] of [['regenerate', 'Speaks in clipped sailor slang.'], ['swipe', 'Speaks in courtly riddles.'], ['continue', 'Speaks in hushed whispers.']]) {
        remoteAdvance(state => { Object.assign(state.npcs.find(npc => npc.name === 'Mira Voice'), { speech, present: true }); });
        const promptsBefore = mockState.prompts.length;
        for (const listener of mockState.listeners.get('generation_after_commands') || []) await listener(type, {}, false);
        if (named('Mira Voice')?.speech !== speech) fail(`RB93-03 (${type}): the newer canonical Speech was not adopted before generation`);
        const injected = mockState.prompts.slice(promptsBefore).map(args => String(args[1] || '')).join('\n');
        if (!injected.includes(speech)) fail(`RB93-03 (${type}): the rebuilt injection does not carry the current Speech`);
    }
    const quietReads = mockState.prompts.length;
    for (const listener of mockState.listeners.get('generation_after_commands') || []) await listener('quiet', {}, false);
    if (mockState.prompts.length !== quietReads) fail('RB93-03: a quiet generation rebuilt the roleplay injection');

    // RB93-04/05: every single-target channel binds to the target's resolved identity.
    await open('rb93-scope', ['Mira Deep, Noela Deep and Kora Deep meet.', '<New_NPC name="Mira Deep">Name: Mira Deep\nRole: guard</New_NPC>']);
    await manualAddNpc('Mira Deep');
    await manualAddNpc('Noela Deep');
    await manualAddNpc('Kora Deep');
    await runtime.flush();
    remoteAdvance(state => {
        for (const npc of state.npcs) {
            if (npc.name === 'Kora Deep') continue;
            npc.appearanceForms = [{ name: 'Human', appearance: 'A tall woman in grey.' }, { name: 'Dragon', appearance: 'A silver dragon.' }];
            npc.currentForm = 'Human';
        }
    });
    await runtime.ensureFresh();
    const ids = () => ({ mira: named('Mira Deep').id, noela: named('Noela Deep').id, kora: named('Kora Deep').id });
    const foreignBond = () => (runtime.getState().socialGraph?.edges || []).some(edge => [edge.aId, edge.bId].includes(ids().noela) && [edge.aId, edge.bId].includes(ids().kora));
    const respond = payload => { mockState.quietResponder = async () => JSON.stringify(payload); };
    // Structured import (a matching New_NPC block exists): foreign profile and edge channels are dropped.
    respond({
        npcs: [{ id: ids().mira, name: 'Mira Deep', role: 'guard' }],
        profileUpdates: [{ id: ids().noela, name: 'Noela Deep', currentForm: 'Dragon', currentFormState: 'change' }],
        keyRelationshipEdges: [{ aId: ids().noela, a: 'Noela Deep', bId: ids().kora, b: 'Kora Deep', aToB: 'friend', bToA: 'friend', reason: 'they meet' }],
    });
    await runtime.scanDossier(ids().mira);
    await sleep(100);
    if (named('Noela Deep').currentForm !== 'Human') fail('RB93-04: the structured import switched another NPC\'s form');
    if (foreignBond()) fail('RB93-04: the structured import created a bond between two other NPCs');
    // Contradictory identities: an exact target id carrying another NPC's name, and an endpoint
    // whose id and label disagree, are rejected in backfill and Refresh.
    mockState.context.chat[1].mes = 'Mira Deep nods to Noela Deep and Kora Deep.';
    const contradictory = {
        npcs: [{ id: ids().mira, name: 'Mira Deep', mood: 'calm' }],
        profileUpdates: [{ id: ids().mira, name: 'Noela Deep', currentForm: 'Dragon', currentFormState: 'change' }],
        keyRelationshipEdges: [{ aId: ids().noela, a: 'Mira Deep', bId: ids().kora, b: 'Kora Deep', aToB: 'friend', bToA: 'friend', reason: 'they meet' }],
    };
    respond(contradictory);
    await runtime.scanDossier(ids().mira);
    await sleep(100);
    respond(contradictory);
    await runtime.refreshFromChat(ids().mira);
    await sleep(100);
    if (named('Noela Deep').currentForm !== 'Human' || named('Mira Deep').currentForm !== 'Human') fail('RB93-05: a contradictory profile row switched a form');
    if (foreignBond()) fail('RB93-05: an endpoint whose id and label disagree created a foreign bond');
    // Control: the target's own profile and a target-touching edge still apply.
    respond({
        npcs: [{ id: ids().mira, name: 'Mira Deep', mood: 'calm' }],
        profileUpdates: [{ id: ids().mira, name: 'Mira Deep', currentForm: 'Dragon', currentFormState: 'change', currentFormReason: 'Mira Deep becomes a dragon' }],
        keyRelationshipEdges: [{ aId: ids().mira, a: 'Mira Deep', bId: ids().kora, b: 'Kora Deep', aToB: 'friend', bToA: 'friend', reason: 'Mira Deep and Kora Deep are friends' }],
    });
    mockState.context.chat[1].mes = 'Mira Deep becomes a dragon. Mira Deep and Kora Deep are friends.';
    await runtime.refreshFromChat(ids().mira);
    await sleep(100);
    mockState.quietResponder = null;
    if (!(runtime.getState().socialGraph?.edges || []).some(edge => [edge.aId, edge.bId].includes(ids().mira) && [edge.aId, edge.bId].includes(ids().kora))) fail('RB93-05 control: the target-touching edge was dropped');

    // RB93-06: a lost acknowledgement of Detach's canonical replacement keeps the original backup registered.
    await open('rb93-detach', ['Vessa Broken waits.', 'Vessa Broken sighs.']);
    await manualAddNpc('Vessa Broken');
    await runtime.flush();
    const detachKey = runtime.uiStatus().chatKey;
    const detachPath = runtime.dataFile().path;
    mockState.files.set(detachPath, '{"format": not json');
    // Visiting more chats than the working cache holds evicts the inactive copy, so returning
    // hydrates from the (now corrupt) sidecar.
    for (let i = 0; i < 8; i += 1) await open(`rb93-detach-away-${i}`, ['Elsewhere.', 'Still elsewhere.']);
    await open('rb93-detach', ['Vessa Broken waits.', 'Vessa Broken sighs.']);
    await runtime.ensureFresh().catch(() => null);
    if (runtime.uiStatus().hydrationStatus !== 'error') fail(`RB93-06: the corrupt sidecar did not block hydration (${runtime.uiStatus().hydrationStatus})`);
    const previousConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    let loseAck = true;
    globalThis.fetch = async (url, options = {}) => {
        const response = await baseFetch(url, options);
        if (url === '/api/files/upload' && loseAck) {
            const body = JSON.parse(options.body || '{}');
            if (`/user/files/${body.name}` === detachPath) { loseAck = false; throw new TypeError('acknowledgement lost'); }
        }
        return response;
    };
    const detach = uiHandlers.get('click.npcStateDelta|.npc-state-delta-detach-sidecar');
    await detach();
    await sleep(100);
    globalThis.fetch = baseFetch;
    const firstRecord = settings.recoveryFiles?.[detachKey];
    if (!firstRecord?.path || mockState.files.get(firstRecord.path) !== '{"format": not json') fail('RB93-06: the verified backup was not registered before the lost acknowledgement');
    await detach();
    await sleep(100);
    globalThis.confirm = previousConfirm;
    const record = settings.recoveryFiles?.[detachKey];
    if (mockState.files.get(record?.path) !== '{"format": not json') fail('RB93-06: the retry registered the empty marker as the preserved sidecar');
    if (runtime.uiStatus().hydrationStatus !== 'ready') fail('RB93-06: the retry did not start a fresh dossier');

    // RB93-01: a resumed rename whose destination read fails keeps its verified copies.
    await open('rb93-rename', ['Ina Resume counts coins.', 'Ina Resume smiles.']);
    await manualAddNpc('Ina Resume');
    await runtime.flush();
    const oldKey = runtime.uiStatus().chatKey;
    const oldOwner = oldKey.split(':')[1];
    const oldPath = runtime.dataFile().path;
    await open('rb93-rename-away', ['Elsewhere.', 'Still elsewhere.']);
    let uncertain = true;
    globalThis.fetch = async (url, options = {}) => {
        if (url === '/api/files/upload' && uncertain) {
            const body = JSON.parse(options.body || '{}');
            const text = Buffer.from(body.data, 'base64').toString('utf8');
            if (`/user/files/${body.name}` === oldPath && /"retired":\s*true/.test(text)) {
                uncertain = false;
                await baseFetch(url, options);
                throw new TypeError('network connection lost after the write');
            }
        }
        return baseFetch(url, options);
    };
    const renameTo = `${oldOwner}-renamed`;
    const rename = async () => { for (const listener of mockState.listeners.get('character_renamed') || []) await Promise.resolve(listener(oldOwner, renameTo)).catch(() => null); };
    await rename();
    const pending = settings.pendingRenames?.[oldKey];
    if (!pending?.newPointer?.path) fail('RB93-01: the uncertain rename left no resumable record');
    let failDestination = true;
    globalThis.fetch = async (url, options = {}) => {
        if (url === pending.newPointer.path && (options.method || 'GET') === 'GET' && failDestination) {
            failDestination = false;
            return { ok: false, status: 503, text: async () => 'unavailable' };
        }
        return baseFetch(url, options);
    };
    await rename();
    globalThis.fetch = baseFetch;
    if (!settings.pendingRenames?.[oldKey]) fail('RB93-01: the failed resume dropped its resumable record');
    if (!mockState.files.has(pending.newPointer.path)) fail('RB93-01: the failed resume deleted the verified destination');
    if (pending.recoveryPointer?.path && !mockState.files.has(pending.recoveryPointer.path)) fail('RB93-01: the failed resume deleted the verified recovery copy');
    await rename();
    const newKey = oldKey.replace(`:${oldOwner}:`, `:${renameTo}:`);
    const moved = settings.dataFiles?.[newKey]?.path;
    if (!moved || !(mockState.files.get(moved) || '').includes('Ina Resume')) fail('RB93-01: a healthy retry did not restore Ina under the new owner');

    setTimeout(() => process.exit(0), 1500);
}

test('RB93-01/02/03/04/05/06 run through the synthetic host', () => {
    let source = fs.readFileSync(new URL('./runtime-smoke.mjs', import.meta.url), 'utf8');
    source = source.replace('const here = path.dirname(fileURLToPath(import.meta.url));', `const here = ${JSON.stringify(fileURLToPath(new URL('.', import.meta.url)))};`);
    // The host emits GENERATION_AFTER_COMMANDS for every generation; the smoke host omits it.
    const events = "        CHAT_RENAMED: 'chat_renamed',\n";
    if (!source.includes(events)) throw new Error('Runtime smoke event table changed');
    source = source.replace(events, `${events}        GENERATION_AFTER_COMMANDS: 'generation_after_commands',\n`);
    const marker = "    console.log('Runtime smoke:";
    if (!source.includes(marker)) throw new Error('Runtime smoke cleanup marker changed');
    const urls = "{ hardening: pathToFileURL(path.join(extRoot, 'hardening.js')).href }";
    source = source.replace(marker, `    await (${deepAuditRuntimeChecks.toString()})(mockState, eventSource, manualAddNpc, sleep, ${urls});\n${marker}`);
    execFileSync(process.execPath, ['--import', new URL('./active-runtime-test-setup.mjs', import.meta.url).href, '--input-type=module'], {
        input: source,
        encoding: 'utf8',
        timeout: 180000,
        maxBuffer: 16 * 1024 * 1024,
    });
});
