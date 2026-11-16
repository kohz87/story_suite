// Story Director v2, tracker part (domain): builds a fresh `director` slice.

export function initialDirector() {
    return {
        time: { minutes: null },
        threads: {},
        keys: {},
        writes: {},
        problems: {},
        // The steps each thread has been through, under "<reply>.<n>" keys (capture-parts/step-trail.js).
        steps: {},
        turn: { n: 0, now: null },
        // The time part's last settle and its While away recap (slots, time/settle.js).
        checked: null,
        recap: null,
        // NPC initiative's last pick (a slot, initiative.js); an older chat has none (read as null).
        initiative: null,
        // The World pulse's last results and the reader's quiet-scene flag (slots, pulse/effects.js); an older chat has none (read as null).
        pulse: null,
        pulseQuiet: null,
    };
}
