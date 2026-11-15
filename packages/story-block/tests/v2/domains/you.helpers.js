import assert from 'node:assert/strict';
import { createHost } from '../../../testkit/index.js';

export const block = (story, lines) => `${story}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
export const staticText = host => host.st.requests.at(-1)?.chat?.[0]?.content ?? '';
export const tailText = host => host.st.requests.at(-1).chat.filter(message => message.role === 'system').slice(1).map(message => message.content).join('\n');
export const lastIndex = host => host.ctx.chat.length - 1;
export const settle = () => new Promise(resolve => setImmediate(resolve));
export const NONE = { rank: '', wearing: '', condition: '' };

// A pack that gives {{user}}'s look a Rank (`content.you.rank`); without one a story has no Rank.
export const rankPack = (id = 'guild', label = 'Guild rank') => ({ id, version: '1.0.0', requires: { storyBlock: '^2' }, content: { you: { rank: { label } } } });
// scene.you without the label's word, or null (what most of these tests compare).
export const look = host => {
    const found = host.sdk.query('scene.you');
    if (!found) return found;
    const { rankLabel: _label, ...rest } = found;
    return rest;
};

export async function fresh(t, { rank = true, ...options } = {}) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost(options);
    t.after(() => host.close());
    if (rank) assert.equal((await host.packs.packs.install(rankPack())).ok, true);
    await host.send('Hello.', block('The road to the harbour.', ['~ place Vell Harbour | kind: settlement']));
    return host;
}
