import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHost } from '../../../testkit/index.js';
import { createNpcRecord, normalizeNpcRecord as normalizeProduction } from '../core.js';
import { normalizeCast, applyCastEntry } from '../src/cast-dossier.js';
import { MODULE_ID, createStorySuiteV2Adapter } from '../src/storysuite-v2.js';

export const DAY = 1440;
export const FENNA_ENTRY = {
    id: 'fenna', name: 'Fenna', aliases: ['the ferrywoman'],
    about: 'Runs the night ferry at Bluewatch docks.',
    look: 'Tall and weathered, rope-scarred hands, a grey oilskin coat.',
    voice: 'Dry and unhurried; says "aye" for yes.',
    personality: 'Stubborn, watchful, quietly kind.',
    history: 'Lost her husband to the weir in 598; has run the night ferry alone since.',
    portrait: 'fenna.webp',
    start: { place: 'Bluewatch docks', goal: 'Find out who opened the weir', routine: 'evenings at the ferry' },
    drawnTo: ['whoever fought at the weir'],
    meters: { preset: 'companion', trust: 10, loyalty: 30, nonsense: 5 },
    stages: [{ name: 'Wary', needs: 'trust 5' }, { name: 'Ally', needs: 'trust 40, loyalty 50' }],
    fields: { Allegiance: 'Ferry guild' },
    secrets: [
        { title: "Her husband's debt", text: 'He owed the smugglers; she still pays it off.', meter: 'trust', at: 60 },
        { title: 'The weir', text: 'She saw who opened the gates.', when: 'the party learns of the toll-gang' },
    ],
};
export const person = (extra = {}) => ({
    key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', aliases: ['the ferrywoman'],
    met: { on: 11 * DAY, where: 'Bluewatch docks' }, where: 'upriver', doing: 'on the ferry to Ashford',
    lastHeard: { text: 'took the ferry upriver to Ashford', on: 14 * DAY }, alive: true, entry: structuredClone(FENNA_ENTRY), ...extra,
});
export const unmet = () => person({ met: null, entry: undefined, lastHeard: undefined });
export const calendar = { era: 'CY', months: [{ name: 'Goldwane', days: 30 }], leapYears: false };
export const dateText = minutes => `Gw ${Math.floor(minutes / DAY) + 1}`;

export const TEMIWA_ENTRY = {
    id: 'temiwa', name: 'Temiwa', about: 'A fox-woman courier.',
    look: 'Slender fox-woman, amber eyes, russet fur, a white-tipped tail.',
    wears: 'Veil of grey gauze, a grey sash binding the tail, flame-cross pendants.',
    start: { place: 'The north gate', goal: 'Deliver the letter' },
};
export const temiwaPerson = (entry = TEMIWA_ENTRY) => normalizeCast([{
    key: 'ersveil:temiwa', pack: 'ersveil', id: 'temiwa', name: 'Temiwa', met: { on: 0, where: 'The north gate' }, alive: true, entry,
}], dateText)[0];
export const madeTemiwa = entry => normalizeProduction(applyCastEntry(createNpcRecord('Temiwa', []), temiwaPerson(entry), { packName: 'Ersveil' }));

export const ERSVEIL = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./fixtures/ersveil-cast.json', import.meta.url)), 'utf8'));

export const director = () => ({
    id: 'zz-director', name: 'Director (stand-in)', version: '0.0.0-test',
    domains: { director: { initial: () => ({ time: { minutes: 0 }, cast: [] }) } },
    commands: {
        'zz.cast': (ctx, { list }) => { ctx.draft('director').cast = list.map(row => JSON.stringify(row)); return { summary: 'cast' }; },
    },
    capture: {
        kinds: { meet: { grammar: '~ meet Name' } },
        apply: (ctx, line) => {
            const slice = ctx.draft('director');
            const at = slice.cast.findIndex(text => JSON.parse(text).name.toLowerCase() === String(line.name).toLowerCase());
            if (at < 0) ctx.fail('NOT_FOUND', 'Nobody by that name.');
            const found = JSON.parse(slice.cast[at]);
            found.met = { on: 11 * DAY, where: 'Bluewatch docks' };
            slice.cast[at] = JSON.stringify(found);
            return { summary: `met ${found.name}` };
        },
    },
    queries: {
        'director.time': state => ({ minutes: state?.domains?.director?.time?.minutes ?? null }),
        'director.calendar': () => calendar,
        'director.cast': state => (state?.domains?.director?.cast ?? []).map(text => JSON.parse(text)).map(item => (item.met ? item : { ...item, entry: undefined })),
    },
});
export const castRow = (extra = {}) => ({ key: 'ersveil:fenna', pack: 'ersveil', id: 'fenna', name: 'Fenna', aliases: [], met: null, alive: true, entry: structuredClone(FENNA_ENTRY), ...extra });
export const OLD_DEFAULTS = { 'npc-state-delta.anti-lever': false, 'npc-state-delta.mood-pull': false, 'npc-state-delta.notes': false };

export async function suite({ settings = {}, features = null, modules = [director()], castSync, castPortraitDue } = {}) {
    const records = {};
    const host = await createHost({ settings: { modules: { [MODULE_ID]: structuredClone(settings) }, ...(features ? { features: { ...features } } : {}) }, modules });
    const box = { ready: Promise.resolve(host.sdk), sdk: host.sdk };
    const api = {
        isEnabled: () => true,
        getNpc: id => (records[id] ? structuredClone(records[id]) : null),
        relationshipBaseline: () => ({ trust: 0, affection: 0, desire: 0, tension: 0 }),
        presentCastHtml: () => '', castEmptyReason: () => ({ text: '' }), fillPresentCast: () => {},
    };
    const synced = [];
    const adapter = createStorySuiteV2Adapter({
        suiteApi: { npcs: () => Object.values(records).map(({ id, name, aliases, present, archived }) => ({ id, name, aliases, present, archived })) },
        delta: () => api, version: 'test', host: () => box, headReply: () => host.store.headIndex(),
        castSync: castSync ?? (async () => { synced.push(host.store.headIndex()); }),
        ...(castPortraitDue ? { castPortraitDue } : {}),
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
    const swipe = async lines => { await host.swipe(`Another way.${lines?.length ? `\n\n<Changes>\n${lines.join('\n')}\n</Changes>` : ''}`); await adapter.ticked(); };
    const world = async list => { await host.sdk.command('zz.cast', { list }); };
    const made = () => host.sdk.query('npc.castMade', {});
    const meters = name => host.sdk.query('npc.meters', { name });
    return { host, adapter, say, swipe, world, made, meters, synced };
}

export const scenarioOutput = output => JSON.parse(String(output).split('\n').find(line => line.startsWith('RESULT ')).slice(7));
