import { createHost } from '../../packages/story-block/testkit/index.js';
import { CHATTER_FEATURE, CHOICES_FEATURE, displayLines } from '../../packages/story-block/src/v2/extras.js';

export const BOTH = { features: { [CHOICES_FEATURE]: true, [CHATTER_FEATURE]: true } };
export const block = (story, lines) => `${story}\n\n<Changes>\n${lines.join('\n')}\n</Changes>`;
export const REPLY = block('The wall rose above the yard. Minke watched the gate.', [
    '+ item Rope | qty: 1',
    '? choice Climb the wall',
    '? choice Bribe the guard',
    '~ chatter Minke: …he\'d better not die down there',
    '~ chatter Arn — *keep your head down, boy*',
]);
export const lastIndex = host => host.ctx.chat.length - 1;
export const extrasOf = (host, index = lastIndex(host)) => displayLines(host.ctx.chat[index].mes, { entryOf: word => host.registry.capture(word) });
// The static part as the last request carried it (the slots are emptied after each reply).
export const staticText = host => host.st.requests.at(-1)?.chat?.[0]?.content ?? '';

export async function fresh(t, settings = BOTH, modules = []) {
    t.mock.method(console, 'warn', () => {});
    const host = await createHost({ settings, modules });
    t.after(() => host.close());
    await host.send('Hello.', 'The road to the Watch Granary.');
    return host;
}
