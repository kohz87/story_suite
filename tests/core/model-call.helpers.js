import { EVENT_TYPES, createFakeContext } from '../../packages/story-block/testkit/index.js';
import { createRuntime } from '../../core/runtime.js';

// A module that plans with its own model call, behind a feature, with a profile setting.
export const planner = (extra = {}) => ({
    id: 'planner',
    name: 'Planner',
    features: [{ id: 'planner.arc', label: 'Arc planning', default: true }],
    settings: {
        defaults: { connection: '' },
        schema: { connection: { type: 'profile', label: 'Planning connection', help: 'Which model plans arcs.' } },
    },
    ...extra,
});
export const other = () => ({ id: 'other', name: 'Other', features: [{ id: 'other.flavour', label: 'Flavour' }] });

// A timer the test fires by hand: { setTimeout, clearTimeout, fire(), last (ms asked), cleared }.
export function handTimer() {
    const timer = { pending: null, last: null, cleared: 0 };
    timer.setTimeout = (fn, ms) => { timer.pending = fn; timer.last = ms; return 1; };
    timer.clearTimeout = () => { timer.cleared += 1; };
    timer.fire = () => timer.pending?.();
    return timer;
}

// A SillyTavern with two Connection Manager profiles (and one it cannot use), recording each request.
export function fakeSt({ cmOff = false, cm = true, profiles = null } = {}) {
    const requests = [];
    const raws = [];
    const ctx = {
        mainApi: 'openai',
        chat: [{ is_user: true, mes: 'hello' }],
        extensionSettings: {
            disabledExtensions: cmOff ? ['connection-manager'] : [],
            connectionManager: {
                selectedProfile: 'p-main',
                profiles: profiles ?? [
                    { id: 'p-main', name: 'Main', api: 'openai', 'secret-id': 'sk-secret-main-123456789', 'api-url': 'https://main.example' },
                    { id: 'p-cheap', name: 'Cheap', api: 'openai', 'secret-id': 'sk-secret-cheap-123456789', 'api-url': 'https://cheap.example' },
                    { id: 'p-img', name: 'Images only', api: 'sd' },
                ],
            },
        },
        async generateRaw(options) {
            raws.push(options);
            return 'from the chat connection';
        },
    };
    if (cm) {
        ctx.ConnectionManagerRequestService = {
            isProfileSupported: profile => profile?.api === 'openai',
            async sendRequest(id, messages, maxTokens, custom) {
                requests.push({ id, messages, maxTokens, custom });
                return { content: `from ${id}` };
            },
        };
    }
    return { ctx, requests, raws };
}

export function withSt(st, fn) {
    const before = globalThis.SillyTavern;
    globalThis.SillyTavern = { getContext: () => st.ctx };
    const restore = () => { if (before === undefined) delete globalThis.SillyTavern; else globalThis.SillyTavern = before; };
    try {
        const out = fn();
        if (out && typeof out.then === 'function') return out.finally(restore);
        restore();
        return out;
    } catch (error) {
        restore();
        throw error;
    }
}

// A runtime on the fake SillyTavern, wired as the testkit's host is, whose model call on the chat's connection
// behaves as generateRaw does: SillyTavern's prompt-ready event for its own short chat, then the answer.
export async function rawHost({ modules = [], hold = null } = {}) {
    const st = createFakeContext({});
    const ctx = st.ctx;
    const seen = { calls: [], interceptor: 0 };
    const callModel = async (prompt, { profile = '', system = '' } = {}) => {
        seen.calls.push({ prompt, profile, at: rt?.turn.replyBusy() });
        if (!profile) {
            const chat = [{ role: 'system', content: system }, { role: 'user', content: prompt }];
            await ctx.eventSource.emit(EVENT_TYPES.CHAT_COMPLETION_PROMPT_READY, { chat, dryRun: false });
            seen.lastChat = chat;
        }
        return `answer to ${prompt}`;
    };
    const rt = createRuntime({ ctx, modules, callModel, notify: () => {} });
    rt.turn.install({ globalName: null });
    st.interceptor = async (...args) => {
        seen.interceptor += 1;
        await rt.turn.interceptor(...args);
        if (hold) await hold(rt);
    };
    await rt.turn.onChatChanged();
    rt.markReady();
    return { st, ctx, rt, seen };
}
export const tick = () => new Promise(resolve => setTimeout(resolve, 0));

// A fake call per prompt: it starts when called and ends when its test says so.
export function heldCalls() {
    const started = [];
    const ends = new Map();
    const call = (prompt, { profile, signal }) => new Promise((resolve, reject) => {
        started.push(`${profile || 'chat'}:${prompt}`);
        ends.set(prompt, resolve);
        signal?.addEventListener?.('abort', () => reject(new Error('aborted')), { once: true });
    });
    return { call, started, end: (prompt, text = `answer ${prompt}`) => ends.get(prompt)?.(text) };
}
export const later = () => new Promise(resolve => setTimeout(resolve, 0));
