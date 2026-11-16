import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// One-pass narration capture through the real event handlers of the synthetic SillyTavern host.
// Each scenario runs in its own process on a fresh host built from the runtime-smoke setup
// (everything before its scenario body), so no scenario depends on the long smoke run.

const TRY_MARKER = '\ntry {\n    await import(pathToFileURL(path.join(extRoot, \'index.js\'))';

export function runScenario(name, scenario, { makeFirst = false } = {}) {
    let source = fs.readFileSync(new URL('./runtime-smoke.mjs', import.meta.url), 'utf8');
    source = source.replace('const here = path.dirname(fileURLToPath(import.meta.url));', `const here = ${JSON.stringify(fileURLToPath(new URL('.', import.meta.url)))};`);
    const cut = source.indexOf(TRY_MARKER);
    if (cut < 0) throw new Error('Runtime smoke import marker changed');
    const script = `${source.slice(0, cut)}
mockState.context.eventTypes.GENERATION_AFTER_COMMANDS = 'generation_after_commands';
mockState.context.eventTypes.GENERATION_STOPPED = 'generation_stopped';
mockState.context.eventTypes.CHAT_COMPLETION_PROMPT_READY = 'chat_completion_prompt_ready';
mockState.updatedBlocks = [];
mockState.context.updateMessageBlock = (id, message) => { mockState.updatedBlocks.push({ id, mes: message.mes }); };
mockState.earlierListenerSaw = [];
if (${makeFirst}) {
    eventSource.makeFirst = (event, fn) => {
        const list = mockState.listeners.get(event) || [];
        list.unshift(fn);
        mockState.listeners.set(event, list);
    };
    // A listener another extension registered before NPC State Delta loaded.
    eventSource.on('message_received', id => { mockState.earlierListenerSaw.push(String(mockState.context.chat[id]?.mes ?? '')); });
}
try {
    await import(pathToFileURL(path.join(extRoot, 'index.js')).href + \`?t=\${Date.now()}\`);
    await sleep(30);
    eventSource.emit('app_ready');
    eventSource.emit('extension_settings_loaded');
    await sleep(30);
    const helpers = (${captureHelpers.toString()})(mockState, eventSource, sleep, manualAddNpc);
    await (${scenario.toString()})(helpers);
    console.log('narration capture scenario ${name} passed');
} finally {
    for (const handle of pendingHostTimers) nativeClearTimeout(handle);
    pendingHostTimers.clear();
    delete globalThis.__npcMock;
    fs.rmSync(tempRoot, { recursive: true, force: true });
}
`;
    try {
        execFileSync(process.execPath, ['--import', new URL('./active-runtime-test-setup.mjs', import.meta.url).href, '--input-type=module'], {
            input: script,
            encoding: 'utf8',
            timeout: 120000,
            maxBuffer: 16 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    } catch (error) {
        const stderr = String(error.stderr || '');
        const detail = stderr.split('\n').filter(line => /Error|assert|expected|actual|\bat\b.*<anonymous>/i.test(line)).slice(0, 30).join('\n');
        throw new Error(`scenario ${name} failed:\n${detail || stderr.slice(-4000)}`);
    }
}

// Runs inside the synthetic host. Returns the shared drivers for one scenario.
function captureHelpers(mockState, eventSource, sleep, manualAddNpc) {
    const fail = message => { throw new Error(message); };
    const check = (condition, message) => { if (!condition) fail(message); };
    const equal = (actual, expected, message) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    };
    const runtime = globalThis.NPCStateDelta;
    const settings = mockState.extensionSettings.npc_state_delta;
    const HEADER = 'NPC STATE DELTA ONE-PASS CAPTURE.';
    const REPLY = 'Yunyun, a young woman with long dark brown hair and crimson eyes, waves awkwardly. She remains proud but earnest and stays formal when nervous. Yunyun tells Kazuma she trusts him more and is fond of him.';
    const YUNYUN = {
        name: 'Yunyun', present: true, role: 'adventurer', species: 'Crimson Demon',
        appearance: 'Young woman with long dark brown hair and crimson eyes.',
        personality: 'proud but earnest', speech: 'formal when nervous',
        relationshipSummary: 'She is cautiously warming to Kazuma and beginning to trust him.',
        relationshipImpact: 'meaningful',
        relationshipDelta: { trust: 3, affection: 2, desire: 0, tension: 0 },
        relationshipEvidence: { trust: 'Yunyun tells Kazuma she trusts him more.', affection: 'Yunyun tells Kazuma she is fond of him.', desire: '', tension: '' },
        relationshipChangeReason: 'Yunyun tells Kazuma she trusts him more and is fond of him.',
    };
    const block = (payload = { npcs: [YUNYUN] }) => `\n\n<!--npc_state_delta\n${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n-->`;
    const callsOf = pattern => mockState.rawCalls.map(call => call?.[0] || {}).filter(args => pattern.test(String(args.systemPrompt || '')));
    const scannerCalls = () => callsOf(/isolated dossier scanner\./i);
    const relationshipCalls = () => callsOf(/isolated relationship evaluator/i);
    const dossierPrompts = () => mockState.prompts.filter(args => args[0] === 'story_suite_tail_4_npc_state_delta').map(args => String(args[1] ?? ''));
    // (1.2.13) The capture reminder has its own slot at the end of the prompt (depth 0).
    const captureCalls = () => mockState.prompts.filter(args => args[0] === 'story_suite_tail_5_npc_state_delta_capture');
    // (1.2.16) The capture's rules ride early in the system prompt; its context and reminder at the end.
    const rulesCalls = () => mockState.prompts.filter(args => args[0] === 'story_suite_static_npc_state_delta');
    const lastPrompt = () => [String(rulesCalls().at(-1)?.[1] ?? ''), dossierPrompts().at(-1) ?? '', String(captureCalls().at(-1)?.[1] ?? '')].filter(Boolean).join('\n\n');
    // (b6-soak-3) The request for a block is the reminder and context at the end; the rules stay in
    // the system prompt on every roleplay generation (quiet and impersonate excepted).
    const asked = () => String(captureCalls().at(-1)?.[1] ?? '').includes('Reminder: after the story');
    const rulesNow = () => String(rulesCalls().at(-1)?.[1] ?? '');
    const status = () => runtime.uiStatus().narrationCapture;
    const npc = name => runtime.getState().npcs.find(item => item.name === name) || null;
    // Fire every listener in registration order (as the host does) and wait for the async ones.
    const emitAsync = async (event, ...args) => {
        await Promise.all((mockState.listeners.get(event) || []).map(fn => fn(...args)));
        await sleep(40);
    };
    const generate = (type = 'normal', dryRun = false) => emitAsync('generation_after_commands', type, {}, dryRun);
    const sendUser = async text => {
        mockState.context.chat.push({ is_user: true, is_system: false, name: 'Kazuma', mes: text });
        await emitAsync('message_sent', mockState.context.chat.length - 1);
    };
    const receiveAssistant = async (text, { swipes = [text], swipeId = swipes.length - 1 } = {}) => {
        mockState.context.chat.push({ is_user: false, is_system: false, name: 'Megumin', mes: text, swipe_id: swipeId, swipes: [...swipes] });
        const id = mockState.context.chat.length - 1;
        await emitAsync('message_received', id);
        await sleep(80);
        return id;
    };
    const turn = async (userText, replyText, type = 'normal') => {
        await sendUser(userText);
        await generate(type);
        return receiveAssistant(replyText);
    };
    // The fallback scanner names Yunyun too, so a fallback is visible as a real request.
    mockState.quietResponder = async (args = {}) => {
        if (/isolated dossier scanner\./i.test(String(args.systemPrompt || ''))) return JSON.stringify({ npcs: [{ ...YUNYUN, role: 'scanned adventurer' }] });
        return '{"npcs":[]}';
    };
    return { manualAddNpc, fail, check, equal, runtime, settings, HEADER, REPLY, YUNYUN, block, scannerCalls, relationshipCalls, dossierPrompts, captureCalls, rulesCalls, lastPrompt, asked, rulesNow, status, npc, emitAsync, generate, sendUser, receiveAssistant, turn, mockState, sleep };
}
