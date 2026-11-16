import { SETTING } from '../../../src/v2/assist/index.js';
import { createHost, hostAvailable } from '../../../testkit/index.js';

const available = await hostAvailable();
export const skip = available.ok ? false : available.reason;
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// A model whose first answer waits until `release()`; later answers are 'none'.
export function heldModel(answer) {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const calls = [];
    const model = async prompt => {
        calls.push(prompt);
        if (calls.length === 1) {
            await held;
            return answer;
        }
        return 'none';
    };
    return { model, calls, release: () => release() };
}

export async function hostWith(model) {
    const host = await createHost({ callModel: model, settings: { modules: { 'story-block': { [SETTING.extractor]: true } } } });
    host.features?.set?.('story-block.extractor', true);
    return host;
}

export const BLUEWATCH = 'Osken pays out at the desk; Nelje takes the pork. Kettle-Maw Tam joins them.\n<Changes>\n~ place Bluewatch — Guild Office | kind: settlement\n- present Osken\n+ present Nelje\n~ time CY611, Goldwane 12, 5:30 pm\n! time +2h 30m\n</Changes>';

export const WRONG_STOP = '~ place Bluewatch Outskirts | kind: wild | region: Bluewatch | with: Sister Temiwa';
export const OFFICE_REPLY = 'You drive from Eastern Creek to Temiwa’s yard, sell meat in the village, and enter the Guild office. Sieke and the new clerk Dries greet you.\n<Changes>\n+ present Dries | at: Bluewatch Village / Guild Office\n~ time Goldwane 12, 5:30 pm\n~ chatter Sieke: Welcome back.\n~ chatter Sister Temiwa: We made it.\n~ chatter Dries: A visitor.\n</Changes>';

export const WORLD_PROBE = { id: 'world-probe', version: '1.0.0', domains: { worldProbe: { initial: () => ({ said: [] }) } },
    capture: { kinds: { world: { grammar: '+ world Name — news | state: ongoing | place | factions' }, faction: { grammar: '+ faction Name — what it is | area | stance' } },
        apply(ctx, line) { ctx.draft('worldProbe').said.push(line.raw); return { narrate: false }; } },
    queries: { 'chronicle.events': () => [], 'chronicle.factions': () => [] } };
export const OWNER = ['+ faction Red Cords — pier crew locking down the salt barges | Bluewatch Village | stance: neutral',
    '+ world Shornmarch Wolf-Push — Shornmarch skirmishers pushing wolves onto the timber track | state: ongoing | timber track | factions: Shornmarch'];

export const assistTypes = (host, index) => host.ctx.chat[index].extra.storySuite.receipts.filter(receipt => receipt.assist).map(receipt => `${receipt.type}:${receipt.assist}`);

export const ERRAND_REPLY = 'You leave the Guild office for the tailor, the well and the smithy, then knock at Widow Merne’s door. At the Stray Oar, innkeeper Gerrit serves you stew. You check the baker’s board by the well.\n\nBack inside the Guild office, Sieke and Sister Temiwa settle at the desk.';
export const SAME_VILLAGE = '~ place Bluewatch Village | kind: settlement | region: Bluewatch';
export const AT_VILLAGE = 'Sieke and Sister Temiwa wait.\n<Changes>\n~ place Bluewatch Village | kind: settlement | region: Bluewatch | with: Sieke, Sister Temiwa\n</Changes>';
export const settleTurn = host => new Promise(resolve => host.sdk.on('turn', item => { if (item.type === 'late') resolve(item); }));

export const NATIVE = 'A native change is finishing; every part must agree before the story goes on.';
export async function barrierHost(answer, { waitMs = 2000 } = {}) {
    const { BARRIER } = await import('../../../src/v2/assist/safety.js');
    const old = { ...BARRIER };
    Object.assign(BARRIER, { waitMs, pollMs: 10 });
    const { announceModules } = await import('../../../../../core/sdk/lifecycle.js');
    const { model, release } = heldModel(answer);
    const host = await createHost({ modules: [WORLD_PROBE], callModel: model, settings: { modules: { 'story-block': { [SETTING.extractor]: true, [SETTING.extractorKinds]: '+ world, + faction' } } } });
    host.features?.set?.('story-block.extractor', true);
    const close = host.close.bind(host);
    host.close = () => { Object.assign(BARRIER, old); close(); };
    const setBarrier = on => { host.registry.setRestore(on ? 'pending' : 'idle', on ? NATIVE : ''); announceModules(host.registry, host.events); };
    return { host, release, setBarrier };
}
export const heldProblems = (host, index) => host.turn.problems().filter(item => item.index === index && item.code === 'MODULE_HELD');
