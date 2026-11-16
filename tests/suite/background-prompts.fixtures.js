// Fixed inputs for background-prompts.test.js (NPC State Batch 2 N0): the fixtures and the prompt builders it pins.
const WATCH = [{ key: 's1', name: 'Mira', event: 'The bridge falls' }];

/** Five fixed option sets; the same two people in each, so a diff between prompts is a diff in the rule under test. */
export function FIXTURES(core) {
    const mira = core.normalizeNpcRecord({ id: 'npc_mira', name: 'Mira', present: true, role: 'ferrywoman', personality: 'Dry and watchful.', currentForm: 'Human', appearanceForms: [{ name: 'Human', appearance: 'Short, weathered, grey braid.' }] });
    const oren = core.normalizeNpcRecord({ id: 'npc_oren', name: 'Oren', role: 'guard', personality: 'Loyal.' });
    const story = 'USER: We reach the river.\nASSISTANT: Mira poles the ferry across. "Tomorrow is my birthday," she says. Oren watches the far bank.';
    const bare = core.normalizeNpcRecord({ id: 'npc_mira', name: 'Mira', present: true, role: 'ferrywoman', personality: 'Dry and watchful.' });
    const base = { transcript: story, currentTranscript: 'Mira poles the ferry across. "Tomorrow is my birthday," she says.', existingNpcs: [mira, oren], existingNpc: mira, targetNpc: mira, targetName: 'Mira', userName: 'Ari', charName: 'Narrator', admissionMode: 'conservative' };
    return {
        // No forms on anyone and no transformation or death words: the detailed stage-4 text stays out (its off branch).
        bare: { ...base, existingNpcs: [bare, oren], existingNpc: bare, targetNpc: bare, transcript: 'USER: hi\nASSISTANT: Mira laughs.', currentTranscript: 'Mira laughs.' },
        plain: { ...base, transcript: 'USER: hi\nASSISTANT: Mira laughs.', currentTranscript: 'Mira laughs.' },
        layered_watched: { ...base, transcript: 'USER: hi\nASSISTANT: Mira laughs.', currentTranscript: 'Mira laughs.', layeredSecrets: true, eventWatch: WATCH, newDossier: true },
        stage4_birthday: { ...base, transcript: `${story}\nShe says the old charm lets her transform into a heron form, and Oren dies in the dream.` },
        custom_level: { ...base, transcript: 'USER: hi\nASSISTANT: Mira laughs.', currentTranscript: 'Mira laughs.', customFieldNames: ['Level', 'Class'] },
    };
}

/** The prompts pinned per fixture: fallback scanner (full scan, relationships on), backfill, Refresh, and today's one-pass context.
 * (There is no separate compact-capture context pin: compactCapture changes the rules half of the parts, not the context, so it was byte-identical.) */
export function PROMPTS(core) {
    return {
        scanner: o => core.buildScannerPrompt({ ...o, fullScanMode: true }),
        backfill: o => core.buildBackfillPrompt(o),
        refresh: o => core.buildProfileRefreshPrompt(o),
        onePassContext: o => core.buildNarrationCaptureParts({ ...o, compactCapture: false }).context,
    };
}
