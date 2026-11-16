// The scripted reply, action and facts of each combination-matrix module, plus the order they are registered in.

/** The order modules are registered in (the same as the suite helpers); Story Block's core is always first. */
export const ORDER = ['sd', 'nsd'];

const asObject = value => (value && typeof value === 'object' ? value : {});

export const MODULES = {
    sb: {
        id: 'story-block',
        label: 'SB',
        A: ['~ place Bluewatch Village | kind: settlement', '+ item Torch | qty: 2', '+ present Odda'],
        B: ['~ place Millbrook | kind: settlement', '+ item Rope'],
        C: ['~ place Harrow | kind: settlement', '+ item Lantern | qty: 3'],
        action: host => {
            const stack = Object.values(host.head().domains.inventory.stacks).find(entry => host.head().domains.inventory.defs[entry.def]?.name === 'Torch');
            return ['inventory.drop', { stack: stack?.id, qty: 1 }];
        },
        facts: host => {
            const { scene, inventory } = host.head().domains;
            const items = {};
            for (const stack of Object.values(inventory.stacks)) {
                const name = inventory.defs[stack.def]?.name ?? stack.def;
                items[name] = (items[name] ?? 0) + stack.qty;
            }
            // Who is present is left out: a move leaves them behind, so it depends on the replies before it.
            return { place: scene.place.name, items };
        },
    },
    sd: {
        id: 'story-director',
        label: 'SD',
        dir: 'Story_director',
        entry: 'src/v2/module.js',
        make: (imported, ref) => imported.createModule({
            host: { settings: id => ref.sdk?.settings(id) ?? null, substitute: text => ref.sdk?.substitute(text) },
        }),
        A: ['~ time June 3, 1200, 08:00 am', '+ hook Lost Letter — Orsa lost a letter | giver: Orsa | goal: Find the letter'],
        B: ['~ time June 3, 1200, 10:00 am', '+ hook The Farm — news from the farm | goal: Talk to the farmer'],
        C: ['~ time June 3, 1200, 09:00 am', '+ hook The Mill — news from the mill | goal: Talk to the miller'],
        action: async host => {
            const thread = 'th_matrix01';
            const offered = await host.sdk.command('threads.offer', {
                write: 'wr_matrix01', thread, kind: 'hook', key: 'Read the letter',
                summary: 'Hear what Orsa has to say', fields: { goal: 'Talk to Orsa' }, expectedHash: null,
            });
            if (!offered.ok) throw new Error(`threads.offer: ${offered.message}`);
            return ['threads.accept', { write: 'wr_matrix02', thread, expectedHash: host.sdk.query('threads.hash', { thread }) }];
        },
        facts: host => ({
            minutes: host.head().domains.director?.time?.minutes ?? null,
            goals: host.sdk.query('director.threads', { kind: 'hook' }).map(thread => `${thread.key}:${thread.status}:${thread.acceptance ? 'accepted' : 'open'}`).sort(),
        }),
    },
    nsd: {
        id: 'npc-state-delta',
        label: 'NSD',
        dir: 'npc_state_delta',
        entry: 'src/storysuite-v2.js',
        make: imported => imported.createStorySuiteV2Adapter({
            suiteApi: { npcs: () => [] },
            delta: () => ({ isEnabled: () => true, getNpc: () => null }),
            doc: null,
            timers: {},
            logger: { warn() {} },
        }).definition,
        // One NPC per reply: a meter is kept as the value it reached, so a reply's own NPC is what survives
        // any other reply being swiped or deleted.
        A: ['~ npc Odda | trust: +3'],
        B: ['~ npc Brecht | trust: +2'],
        C: ['~ npc Corin | trust: +4'],
        action: () => ['npc.set', { name: 'Odda', meters: { trust: 40 } }],
        facts: host => Object.fromEntries(Object.values(asObject(host.head().domains.people?.bonds?.npcs)).map(npc => [npc.name, { ...npc.meters }])),
    },

};
