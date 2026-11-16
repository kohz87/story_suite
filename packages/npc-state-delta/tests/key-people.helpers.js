import assert from 'node:assert/strict';
import { createHost } from '../../story-block/testkit/index.js';
import { createNpcRecord } from '../core.js';
import { MODULE_ID, createStorySuiteV2Adapter } from '../src/storysuite-v2.js';

export const REN_AWAY = { doing: 'scouting the north road', since: 'Gw 12', back: 'Gw 18', steps: [{ date: 'Gw 14', text: 'reached Wolfmere Outpost' }, { date: 'Gw 16', text: 'met the toll-gang at the weir' }] };
export const key = (name, extra = {}) => ({ name, aliases: [], here: true, away: null, ...extra });
export const npc = (name, extra = {}) => ({ ...createNpcRecord(name, []), id: `npc_${name.toLowerCase()}`, ...extra });

export const director = () => ({
    id: 'zz-director', name: 'Director (stand-in)', version: '0.0.0-test',
    domains: { director: { initial: () => ({ time: { minutes: 0 }, keyPeople: [] }) } },
    commands: {
        'zz.keys': (ctx, { list, minutes }) => {
            const slice = ctx.draft('director');
            if (Array.isArray(list)) slice.keyPeople = list;
            if (Number.isInteger(minutes)) slice.time.minutes = minutes;
            return { summary: 'key people' };
        },
    },
    queries: {
        'director.time': state => ({ minutes: state?.domains?.director?.time?.minutes ?? null }),
        'director.keyPeople': state => state?.domains?.director?.keyPeople ?? [],
    },
});

export async function suite({ settings = {}, features = null, modules = [director()] } = {}) {
    const records = {
        npc_ren: { id: 'npc_ren', name: 'Ren', aliases: [], present: true, relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } },
        npc_mira: { id: 'npc_mira', name: 'Mira', aliases: [], present: true, relationship: { trust: 0, affection: 0, desire: 0, tension: 0 } },
    };
    const host = await createHost({ settings: { modules: { [MODULE_ID]: structuredClone(settings) }, ...(features ? { features: { ...features } } : {}) }, modules });
    const box = { ready: Promise.resolve(host.sdk), sdk: host.sdk };
    const api = {
        isEnabled: () => true,
        getNpc: id => (records[id] ? structuredClone(records[id]) : null),
        relationshipBaseline: () => ({ trust: 0, affection: 0, desire: 0, tension: 0 }),
        presentCastHtml: () => '', castEmptyReason: () => ({ text: '' }), fillPresentCast: () => {},
    };
    const adapter = createStorySuiteV2Adapter({
        suiteApi: { npcs: () => Object.values(records).map(({ id, name, aliases, present, archived }) => ({ id, name, aliases, present, archived })) },
        delta: () => api, version: 'test', host: () => box, headReply: () => host.store.headIndex(),
        doc: { documentElement: { dataset: {} }, getElementById: () => null, addEventListener() {}, dispatchEvent() { return true; } },
        timers: { setTimeout: () => 0, clearTimeout() {}, setInterval: () => ({ unref() {} }), clearInterval() {} },
        logger: { warn() {} }, loadEmptyCast: async () => null,
    });
    adapter.start();
    assert.equal(await adapter.settled(), true);
    const say = async (lines = []) => {
        await host.send('And then?', `The story goes on.${lines.length ? `\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : ''}`);
        await adapter.ticked();
    };
    const swipe = async () => { await host.swipe('Another way.'); await adapter.ticked(); };
    const keys = async (list, minutes) => { await host.sdk.command('zz.keys', { list, ...(minutes === undefined ? {} : { minutes }) }); };
    const meters = name => host.sdk.query('npc.meters', { name });
    return { host, adapter, say, swipe, keys, meters };
}

export const scenarioOutput = output => JSON.parse(String(output).split('\n').find(line => line.startsWith('RESULT ')).slice(7));
