// Supplies the small interaction kind and stub registry that exercise actors, Auto, opening, carry and a marker.

export const PROBE_ID = 'test/probe';

export const PROBE_KIND = Object.freeze({
    version: 1,
    title: 'Probe',
    feature: null,
    screen: 'test/probe',
    limits: { steps: 4, stepInputs: 2 },
    changes: [],
    ready: () => true,
    marker: { word: 'probe' },
    carry: true,
    actors: () => [
        { id: 'hero', name: 'Astra', party: true },
        { id: 'mate', name: 'Ren', party: true },
    ],
    open: (state, { anchor, seed, args }) => ({ setup: { room: state?.room ?? 1, door: args?.door ?? 'north', anchor, seed } }),
    witness: (state, setup) => ({ room: state?.room ?? 1, door: setup?.door ?? null }),
    validate: (state, setup, steps, step) => {
        if (!Array.isArray(step?.inputs) || step.inputs.length !== 1) return 'Choose one step.';
        return ['go', 'wait'].includes(step.inputs[0].choice) ? null : 'Choose go or wait.';
    },
    play: (state, setup, steps, dice) => {
        const lines = steps.map(step => step.inputs.map(input => `${input.actor}:${input.choice}`).join(','));
        const companion = steps.at(-1)?.inputs.find(input => input.actor === 'mate')?.choice ?? null;
        const roll = dice(steps.length ? steps.length - 1 : 0)(7, 0, 6)();
        return {
            view: { lines, choices: [{ id: 'go', label: 'Go on', actor: 'hero' }] },
            result: { steps: steps.length, lines, companion, roll, stop: 'open' },
            stop: 'open',
        };
    },
    settle: (state, setup, steps, dice) => {
        const preview = PROBE_KIND.play(state, setup, steps, dice);
        return { result: preview.result, changes: [], stop: preview.stop };
    },
    note: (result, setup, { tokens, opening } = {}) => (opening ? [`Probe room ${setup?.room ?? 1} opens (${result.opened}).`] : [`Probe room ${setup?.room ?? 1}: ${result.lines.length} step.`,
        `Probe roll ${result.roll} (${tokens ?? 'default'} tokens).`]),
    auto: (state, setup, steps, actorId, dice) => (actorId === 'mate'
        ? { choice: 'hum', args: { roll: dice(1, 0, 6)() } }
        : { choice: 'go', args: { roll: dice(0, 0, 6)() } }),
    opening: (state, setup, dice) => ({ result: { opened: dice(5, 0, 6)() }, changes: [] }),
    next: (setup, result) => ({ ...setup, room: setup.room + 1, carried: result.steps }),
    view: (state, setup, steps, preview) => ({ ...preview.view, room: setup.room }),
});

/** A registry stub with the probe kind and no real registration or feature wiring. */
export function probeRegistry(kind = PROBE_KIND) {
    return {
        interaction: id => (id === PROBE_ID ? kind : null),
        module: id => (id === 'test' ? { id, interactions: { probe: kind } } : null),
        featureOn: () => true,
    };
}
