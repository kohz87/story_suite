// Assembles the Story Director v2 arc module part definition.

import { commands } from '../commands.js';
import { ARC_TAIL_BUDGET, FEATURE, arcQuery, arcTail, initialArc, validateArc } from '../domain.js';
import { ARC_NEEDS_STORY_BLOCK, NEEDS_TEXT } from '../controller.js';
import { DEFAULTS, SCHEMA, promptSection } from '../settings.js';
import { ARC_WIDGET, arcWidget } from '../widget.js';

function liveSdk() {
    try {
        return globalThis.StoryBlock?.sdk ?? null;
    } catch {
        return null;
    }
}

// The settings panel's own part: the planner prompt with Reset, and the Story Block it needs when this
// one cannot make the call.
const section = Object.assign((el, api) => promptSection(el, api, {
    needs: typeof (api?.sdk ?? liveSdk())?.callModel === 'function' ? '' : NEEDS_TEXT,
}), { feature: FEATURE });

const tail = Object.assign(view => arcTail(view), { feature: FEATURE });

export const part = {
    features: [{
        id: FEATURE,
        label: 'Arc planning',
        describe: `A planner model plans the next arc (beats, agendas, hooks, clocks, secrets) for you to review and accept. Needs Story Block ${ARC_NEEDS_STORY_BLOCK} or newer.`,
        default: true,
        // Lean leaves the world-building threads off, and a plan makes exactly those threads: Lean must not create what it cannot show.
        presets: { lean: false },
    }],
    domains: {
        arc: { initial: initialArc, validate: validateArc },
    },
    commands,
    queries: { 'director.arc': Object.assign(state => arcQuery(state), { feature: FEATURE }) },
    kinds: {},
    context: { static: () => '', tail, budget: ARC_TAIL_BUDGET },
    hooks: {},
    settings: { defaults: { ...DEFAULTS }, schema: { ...SCHEMA }, section },
    widgets: { [ARC_WIDGET]: arcWidget },
    tabs: [],
};
