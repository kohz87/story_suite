// Story Director v2, part screens: the screens part itself (its default screens, queries, widgets and settings).

import { PULSE_FEATURE, SPOILER_WIDGET, directorScreen, pulseQuiet, pulseView, spoilerSwitchWidget } from '../director.js';
import { questsScreen } from '../quests.js';
import { screenQueries } from '../queries.js';
import { statusCardScreen } from '../status-card.js';
import { BEHIND_WIDGET, PLAN_WIDGET, RIPPLES_WIDGET, behindWidget, planWidget, createRipplesWidget, ripplesWidget } from '../behind.js';
import { QUESTS_WIDGET, questsWidget } from '../quest-cards.js';
import { THREADS_FEATURE } from '../../../../../modules/time/tracker/threads.js';

export const MODULE_ID = 'story-director';

/** The default screens, in the order the tab bar shows them. */
export const screens = Object.freeze([questsScreen, directorScreen, statusCardScreen]);

// The module's settings (its calendar), read when a query runs; Story Block's sdk when it is there.
function hostSettings() {
    try {
        return globalThis.StoryBlock?.sdk?.settings?.(MODULE_ID) ?? null;
    } catch {
        return null;
    }
}

/**
 * The part. `settings` (a function or an object) gives the module's settings, for the calendar
 * `director.next` reads dates on; by default Story Block's `sdk.settings('story-director')`.
 */
export function createScreensPart({ settings = hostSettings } = {}) {
    return {
        domains: {},
        commands: {},
        // `pulse.view`: the World pulse card and the status card's roll row; `pulse.quiet`: the header switch's state (feature `story-director.pulse`).
        queries: { ...screenQueries({ settings }), 'pulse.view': Object.assign((state, args, tools) => pulseView(state, args, tools, settings), { feature: PULSE_FEATURE }),
            'pulse.quiet': Object.assign((state, args, tools) => pulseQuiet(state, args, tools, settings), { feature: PULSE_FEATURE }) },
        // The Quiet scene switch in Story Block's game view header (a host that has `headerControls`; the Director tab keeps its own switch otherwise).
        headerControls: [{ id: 'quiet', label: 'Quiet scene', icon: '🌙', query: 'pulse.quiet', command: 'director.pulse.quiet', feature: PULSE_FEATURE }],
        kinds: {},
        hooks: {},
        tabs: [],
        screens: [...screens],
        widgets: { [BEHIND_WIDGET]: behindWidget, [PLAN_WIDGET]: planWidget, [RIPPLES_WIDGET]: ripplesWidget, [QUESTS_WIDGET]: questsWidget, [SPOILER_WIDGET]: spoilerSwitchWidget },
        settings: {
            defaults: { hideBehind: true },
            schema: {
                // Per chat, Reveal shows them (remembered in this browser); this hides nothing from the story.
                // Shown only while the feature `story-director.threads` is on (what it hides is that feature's).
                hideBehind: { type: 'bool', label: 'Behind the scenes: Hide agendas, planned beats, clocks and secrets (the Director screen has its own spoiler switch)', feature: THREADS_FEATURE },
            },
        },
    };
}

export const part = createScreensPart();
