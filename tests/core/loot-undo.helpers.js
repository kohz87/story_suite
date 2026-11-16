import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHost } from '../../testkit/index.js';

export const reply = (text, lines) => `${text}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
export const qty = (host, name) => host.sdk.query('inventory.items').filter(item => item.name === name).reduce((sum, item) => sum + item.qty, 0);
export const coin = host => host.head().domains.inventory.wallets.party?.coin ?? 0;
export const headSid = host => host.store.carrierSid(host.store.headIndex());
export const take = (host, sid, pick) => host.sdk.command('inventory.lootTake', { sid, pick });
export const at = (host, start) => host.ctx.chat.findIndex(message => !message.is_user && message.mes.startsWith(start));
export const claimed = (host, sid) => Object.hasOwn(host.head().meta.claims, `loot:${sid}`);
export const offPs = host => host.store.problems().filter(problem => problem.code === 'REPLAY_PREREQUISITE');
export const riverside = () => {
    const sample = JSON.parse(readFileSync(new URL('../../examples/packs/riverside-starter/pack.json', import.meta.url), 'utf8'));
    sample.start.inventory = { items: [], money: 0 };
    return sample;
};
export const packEntry = (sample, enabled) => ({ id: sample.id, version: sample.version, enabled, source: 'file', origin: 'test', pack: sample });

export async function fresh(t, options = {}) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost(options);
    t.after(() => host.close());
    await host.send('Hello.', 'The road.');
    return host;
}

// The state live, after a rebuild and after a reload of the chat as saved, are the same.
export async function agrees(t, host, label) {
    const live = structuredClone(host.head());
    const problems = host.store.problems().map(problem => [problem.code, problem.why]);
    host.store.rebuild();
    assert.deepEqual(host.head(), live, `${label}: a rebuild equals live`);
    assert.deepEqual(host.store.problems().map(problem => [problem.code, problem.why]), problems, `${label}: the same Problems after a rebuild`);
    const loaded = await createHost({ st: { chat: structuredClone(host.ctx.chat), extensionSettings: structuredClone(host.ctx.extensionSettings) } });
    t.after(() => loaded.close());
    assert.deepEqual(loaded.head(), live, `${label}: a reload equals live`);
    return live;
}

// A crate (Torch x2, Rope, 5 gold) and a later reply; `later` takes on that later reply, else on the crate's own.
export async function crate(t, { later }) {
    const host = await fresh(t);
    await host.send('Search the crate.', reply('A crate.', ['? loot Torch x2, Rope, 5 gold — in the crate']));
    const sid = headSid(host);
    if (later) await host.send('Walk on.', reply('The road goes on.', ['+ item Apple']));
    const taken = await take(host, sid, [0, 2]);
    assert.equal(taken.ok, true, taken.message);
    assert.deepEqual([qty(host, 'Torch'), coin(host), claimed(host, sid)], [2, 5, true]);
    assert.equal(taken.receipt.data.v2.guard.predicate.kind, 'loot.take');
    return { host, sid };
}
