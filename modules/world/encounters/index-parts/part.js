// The encounters part definition: its feature (default off), two commands and two hooks. No static sentence: the one line rides the reply.

import { ENCOUNTERS_FEATURE, ENCOUNTER, PROMOTE } from './ids.js';
import { encounterCommand, promoteCommand } from './command.js';
import { encounterHook, promoteHook } from './hooks.js';

const tagged = (fn, extra = {}) => Object.assign(fn, { feature: ENCOUNTERS_FEATURE, ...extra });

export const part = {
    features: [{
        id: ENCOUNTERS_FEATURE,
        label: 'Encounters',
        describe: 'Before a reply, code may roll one passer-by for the place (a backdrop person from the pack or a built-in one, or someone you have met) and tells the narrator one line. A backdrop person the story names gets a People entry. Off: nothing.',
        default: false,
    }],
    commands: { [ENCOUNTER]: tagged((ctx, payload) => encounterCommand(ctx, payload), { prelude: true }), [PROMOTE]: tagged((ctx, payload) => promoteCommand(ctx, payload)) },
    hooks: { beforeGenerate: tagged((view, info) => encounterHook(view, info)), afterCapture: tagged((view, info) => promoteHook(view, info), { always: true }) },
};
