// The encounters part definition: its feature (default off), two commands and two hooks. No static sentence: the one line rides the reply.

import { ENCOUNTERS_FEATURE, ENCOUNTER, PROMOTE } from './ids.js';
import { encounterCommand, promoteCommand } from './command.js';
import { encounterHook, promoteHook } from './hooks.js';

const tagged = (fn, extra = {}) => Object.assign(fn, { feature: ENCOUNTERS_FEATURE, ...extra });

export const part = {
    features: [{
        id: ENCOUNTERS_FEATURE,
        label: 'Encounters',
        describe: 'A first try. Before a reply, code may roll one passer-by at the place you are (an everyday local, or someone you have met) and tells the narrator one line, at most once a place and part of the day. Off: nothing.',
        default: false,
    }],
    commands: { [ENCOUNTER]: tagged((ctx, payload) => encounterCommand(ctx, payload), { prelude: true }), [PROMOTE]: tagged((ctx, payload) => promoteCommand(ctx, payload)) },
    hooks: { beforeGenerate: tagged((view, info) => encounterHook(view, info)), afterCapture: tagged((view, info) => promoteHook(view, info), { always: true }) },
};
