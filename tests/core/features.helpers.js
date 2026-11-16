import { STATIC_KEY, TAIL_KEY } from '../../src/v2/turn.js';

export const WEAR_GRAMMAR = '~ wear Item | wear: worn|broken';
export const WEAR_STATIC = 'Gear wears out: write a wear line when an item is damaged.';
export const WEATHER_LINE = 'Weather: rain.';
export const BASE_STATIC = 'Gear keeps what the party carries.';

// A module with three features: `gear.wear` (a kind and a static context part, so it changes the static
// prompt), `gear.weather` (a tail part only; off by default) and `gear.extras` (a command, a query, hooks,
// a tab, a screen and a widget).
export function gear({ hooks = {} } = {}) {
    const lookAt = (state, args) => ({ wear: state.domains.gear.wear[args?.item] ?? null });
    lookAt.feature = 'gear.extras';
    const beforeGenerate = () => ['Gear note: extras on.'];
    beforeGenerate.feature = 'gear.extras';
    const canGenerate = () => (hooks.block ? { ok: false, reason: 'Extras say wait.' } : true);
    canGenerate.feature = 'gear.extras';
    return {
        id: 'gear',
        name: 'Gear',
        version: '0.0.1',
        features: [
            { id: 'gear.wear', label: 'Wear', describe: 'Items wear out and break.', default: true },
            { id: 'gear.weather', label: 'Weather', describe: 'A weather line each reply.', default: false },
            { id: 'gear.extras', label: 'Extras', describe: 'A command, a query, a tab and more.' },
        ],
        domains: { gear: { initial: () => ({ wear: {}, polished: 0 }) } },
        commands: {
            'gear.polish': { handler: ctx => { ctx.draft('gear').polished += 1; return { summary: 'Polished.', narrate: false }; }, feature: 'gear.extras' },
            'gear.count': ctx => ({ summary: `${ctx.read('gear').polished}`, narrate: false }),
            // Calls the off command and carries on without it (nothing ran, so this is allowed).
            'gear.try': ctx => {
                let code = null;
                try { ctx.call('gear.polish', {}); } catch (error) { code = error.code; }
                return { summary: 'Tried.', narrate: false, data: { code, extras: ctx.feature('gear.extras'), unknown: ctx.feature('nope.thing') } };
            },
        },
        queries: { 'gear.look': lookAt, 'gear.all': state => state.domains.gear.wear },
        capture: {
            kinds: {
                wear: { grammar: WEAR_GRAMMAR, feature: 'gear.wear' },
                gear: { grammar: '+ gear Item' },
            },
            apply(ctx, line) {
                const draft = ctx.draft('gear');
                if (line.kind === 'wear') draft.wear[line.name] = line.labels?.wear ?? 'worn';
                return { summary: `${line.name}: ${line.kind}`, narrate: false };
            },
        },
        context: {
            static: () => BASE_STATIC,
            tail: view => ({ lines: [`Gear: ${Object.keys(view.state.domains.gear?.wear ?? {}).length} worn.`], optional: [] }),
            parts: [
                { feature: 'gear.wear', static: () => WEAR_STATIC, tail: view => ({ lines: Object.entries(view.state.domains.gear?.wear ?? {}).map(([name, wear]) => `${name} is ${wear}.`) }) },
                { feature: 'gear.weather', tail: () => ({ lines: [WEATHER_LINE] }) },
            ],
            budget: 200,
        },
        hooks: { beforeGenerate, canGenerate },
        tabs: [{ id: 'gear-tab', title: 'Gear', render: el => { el.textContent = 'gear'; }, feature: 'gear.extras' }],
        screens: [
            { id: 'gear/extras', title: 'Extras', mounts: ['tab'], template: '<p>extras</p>', feature: 'gear.extras' },
            { id: 'gear/always', title: 'Always', mounts: ['tab'], template: '<p>always</p>' },
        ],
        widgets: { 'gear.badge': { render: () => null, feature: 'gear.extras' }, 'gear.plain': { render: () => null } },
    };
}

export const statics = host => host.st.promptLog.filter(entry => entry.key === STATIC_KEY && entry.value).map(entry => entry.value);
export const tails = host => host.st.promptLog.filter(entry => entry.key === TAIL_KEY && entry.value).map(entry => entry.value);
