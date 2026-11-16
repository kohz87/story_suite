import assert from 'node:assert/strict';
import { createHost } from '../../testkit/index.js';
import { IDLE_MS } from '../../core/persist.js';
import { createStore } from '../../core/store.js';
import { serveChats } from './helpers/st-server.js';

export const settle = () => new Promise(resolve => setImmediate(resolve));
export const settled = async (n = 6) => { for (let i = 0; i < n; i++) await settle(); };
export const plain = value => JSON.parse(JSON.stringify(value));
export const present = state => [...(state?.domains?.scene?.present ?? [])].sort();
export const headOf = messages => createStore({ chat: () => structuredClone(messages), save: async () => {} }).head();

export async function filed(t) {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    t.mock.method(console, 'warn', () => {});
    const h = await createHost();
    t.after(() => h.close());
    const srv = serveChats(t, h);
    await h.store.flush();
    const saves = () => srv.requests.filter(request => request.url === '/api/chats/save').length;
    const tick = async ms => { t.mock.timers.tick(ms); await settled(); };
    return { h, srv, saves, tick };
}

export const host = (h, name) => h.sdk.command('scene.present', { add: name }, { background: true });
export const turn = async ({ h, tick }, text = 'One.') => {
    await h.send(text, 'Fine.\n<Changes>\n+ present Fenna\n</Changes>');
    await tick(IDLE_MS);
};

export async function chatOf(t, replies = 40) {
    t.mock.method(console, 'warn', () => {});
    const h = await createHost();
    t.after(() => h.close());
    for (let n = 1; n <= replies; n++) {
        await h.send(`Turn ${n}.`, `Reply ${n}.\n<Changes>\n+ item Thing ${n % 7} | qty: 1\n${n % 5 ? '' : `+ present Guest ${n}\n`}</Changes>`);
    }
    await h.store.flush();
    return h;
}
