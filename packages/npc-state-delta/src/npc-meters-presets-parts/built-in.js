// The built-in presets (Companion, Rival, Mentor) as plain frozen records.
export const BUILT_IN_PRESETS = Object.freeze([
    Object.freeze({
        id: 'companion',
        name: 'Companion',
        describe: 'Someone who travels with you: loyalty grows with shared danger and kept promises.',
        meters: Object.freeze([
            Object.freeze({ name: 'Loyalty', min: 0, max: 100, start: 20, tone: 'good', describe: 'rises when you keep promises or share danger; falls when you lie or leave them behind', bands: 'doubtful 25, steady 60, devoted' }),
        ]),
        ladder: Object.freeze([
            Object.freeze({ name: 'Travel companion', needs: 'loyalty 20' }),
            Object.freeze({ name: 'Trusted companion', needs: 'trust 40, loyalty 50' }),
            Object.freeze({ name: 'Sworn companion', needs: 'trust 60, loyalty 75', milestone: 'stood by you in danger' }),
        ]),
        limits: Object.freeze({}),
    }),
    Object.freeze({
        id: 'rival',
        name: 'Rival',
        describe: 'Someone who measures themselves against you: respect is earned, warmth is slow.',
        meters: Object.freeze([
            Object.freeze({ name: 'Respect', min: 0, max: 100, start: 10, tone: 'info', describe: 'rises when you beat or impress them fairly; falls with cheap tricks or backing down', bands: 'dismissive 20, wary 50, grudging 75, admiring' }),
            Object.freeze({ name: 'Rivalry', min: 0, max: 100, start: 50, tone: 'warn', describe: 'rises with each contest or slight; falls when you work together', bands: 'cooling 30, keen 70, fierce', drift: 2, driftTo: 40 }),
        ]),
        ladder: Object.freeze([
            Object.freeze({ name: 'Rival', needs: 'rivalry 30' }),
            Object.freeze({ name: 'Respected rival', needs: 'respect 40' }),
            Object.freeze({ name: 'Grudging ally', needs: 'respect 65, trust 25', milestone: 'fought a common enemy' }),
        ]),
        limits: Object.freeze({ affection: Object.freeze({ ceiling: 40 }) }),
    }),
    Object.freeze({
        id: 'mentor',
        name: 'Mentor',
        describe: 'Someone who teaches you: approval follows your progress. Never romantic (desire stays at 0 or below).',
        meters: Object.freeze([
            Object.freeze({ name: 'Approval', min: 0, max: 100, start: 10, tone: 'accent', describe: 'rises when you heed their lessons and show progress; falls when you ignore advice or act recklessly', bands: 'unimpressed 25, hopeful 60, proud' }),
        ]),
        ladder: Object.freeze([
            Object.freeze({ name: 'Student', needs: 'approval 10' }),
            Object.freeze({ name: 'Apprentice', needs: 'approval 40, trust 30' }),
            Object.freeze({ name: 'Protégé', needs: 'approval 70, trust 50', milestone: 'passed their trial' }),
        ]),
        limits: Object.freeze({ desire: Object.freeze({ ceiling: 0 }) }),
    }),
]);
