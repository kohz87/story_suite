// The pulse part definition: its static sentence, before-reply hook, feature, commands and settings.

import { personaName } from '../../../time/tracker/initiative.js';
import { FEATURE, PULSE, QUIET } from './ids.js';
import { isInt } from './shared-guards.js';
import { pulseOn, modeOf, settingsOf } from './settings.js';
import { pulseCommand, quietCommand } from './command.js';

/** The one static sentence, taught while the feature is on: the same bytes every reply. */
export const PULSE_STATIC = 'World pulse: "World this reply" in the note is a small thing that happens around {{user}}; weave it in lightly, never resolve it for {{user}}.';

/** `beforeGenerate(view, info)`: one `director.pulse` step per reply written (a normal reply, a swipe or a regenerate; a Continue commits nothing). */
export function pulseHook(view, info = {}) {
    if (!view?.state?.domains?.director || !pulseOn(view) || modeOf(settingsOf(view.settings)) === 'off') return undefined;
    const type = String(info?.type ?? 'normal').toLowerCase();
    const length = view?.chat?.length;
    if (info?.commit === false || !['normal', 'swipe', 'regenerate'].includes(type) || !isInt(length)) return undefined;
    // The chat holds the reply being swiped, so the reply's place is one below its length.
    return { commands: [{ type: PULSE, payload: { at: Math.max(0, length - (type === 'swipe' ? 1 : 0)), age: 1, reach: 3, pulse: 2, persona: personaName() } }] };
}

// A prelude (Story Block registry.isPrelude): the host previews it for the prompt and stores it on the generated reply with the same seed.
const tagged = (fn, extra = {}) => Object.assign(fn, { feature: FEATURE, ...extra });

export const part = {
    features: [{
        id: FEATURE,
        label: 'World pulse',
        describe: 'Before each reply a d20 decides if something small happens around you: an incident, news, a chance meeting, an arrival. One line goes with the reply. Skipped after a rest or a long jump, and in a quiet scene.',
        default: true,
    }],
    commands: { [PULSE]: tagged((ctx, payload) => pulseCommand(ctx, payload), { prelude: true }), [QUIET]: tagged((ctx, payload) => quietCommand(ctx, payload)) },
    context: { parts: [{ feature: FEATURE, static: () => PULSE_STATIC }] },
    hooks: { beforeGenerate: pulseHook },
    settings: {
        defaults: { mode: 'lively', showUnderReply: false, invents: true },
        schema: {
            mode: {
                type: 'choice', form: 'segmented', label: 'World pulse', feature: FEATURE,
                options: [{ value: 'off', label: 'Off' }, { value: 'quiet', label: 'Quiet' }, { value: 'lively', label: 'Lively' }],
                help: 'Off: nothing. Quiet: small background touches only. Lively: rumours, meetings, arrivals and schedule shifts too.',
            },
            invents: { type: 'bool', label: 'Pulse invents events (model)', help: 'On: the note asks the narrator to invent one small event from the people and threads in play. Off: fixed lines.', feature: FEATURE },
            showUnderReply: { type: 'bool', label: 'Show the roll under replies', help: 'Off: only the Director tab shows it (spoilers).', feature: FEATURE },
        },
    },
};
