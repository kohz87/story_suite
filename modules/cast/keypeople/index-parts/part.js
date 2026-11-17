// Story Director v2, part **keypeople**: the part definition (feature, domain, commands, kinds, context, settings, widget).

import { pin, sync, tell, unpin, applyAwayLine, applyKeyLine } from '../capture.js';
import { DEFAULT_CAP, DEFAULT_TOKENS, FEATURE, MAX_CAP, initialKeyPeople, validateKeyPeople } from '../domain.js';
import { GRAMMAR, tail, tokensOf } from '../note.js';
import { queries } from '../queries.js';
import { KEY_PEOPLE_WIDGET, keyPeopleWidget } from '../widget.js';
import { afterCapture, beforeGenerate } from './hooks.js';

const tagged = fn => Object.assign(fn, { feature: FEATURE });

/** The most the narrator is told of key people, in tokens, for a part's own settings: the module's budget follows it (module.js). */
const budgetOf = settings => tokensOf(settings);

export const part = {
    // No `presets`: Lean keeps it (the reader's own switch is the only one).
    features: [{
        id: FEATURE,
        label: 'Key people',
        describe: 'People you pin stay in the story while they are away: what they are doing, when they are due back and the news on the way, told to the narrator each reply. Their return or death takes them off the list. World → Now shows and edits the list.',
        default: true,
    }],
    domains: { keypeople: { initial: initialKeyPeople, validate: validateKeyPeople } },
    commands: {
        'keypeople.pin': tagged((ctx, payload) => pin(ctx, payload)),
        'keypeople.unpin': tagged((ctx, payload) => unpin(ctx, payload)),
        'keypeople.sync': tagged((ctx, payload) => sync(ctx, payload)),
        'keypeople.tell': tagged((ctx, payload) => tell(ctx, payload)),
    },
    queries,
    kinds: {
        // Taught only while someone is pinned (module.js tells the parts `keyPeople`).
        away: { grammar: env => (env?.keyPeople ? GRAMMAR.away : ''), apply: applyAwayLine, feature: FEATURE },
        // Replay only: `- key Name | died` is no longer taught (the Director reads deaths from NPC State), but replies that carry it still replay.
        key: { grammar: () => '', heads: ['- key'], apply: applyKeyLine, feature: FEATURE },
    },
    context: {
        tail: view => tail(view),
        // The tokens the tail may spend: the setting (module.js follows it, so a larger budget is not cut by the module's).
        budget: DEFAULT_TOKENS,
        budgetOf,
    },
    hooks: { beforeGenerate: tagged(beforeGenerate), afterCapture: tagged(afterCapture) },
    settings: {
        section: 'Key people',
        defaults: { cap: DEFAULT_CAP, tokens: DEFAULT_TOKENS },
        schema: {
            cap: {
                type: 'int', label: 'How many key people', group: 'Key people', min: 0, max: MAX_CAP, feature: FEATURE,
                help: 'Pinned people whose off-screen story keeps going, in Lean too. Archiving a dossier or a death unpins them.',
            },
            tokens: {
                type: 'int', label: 'Narrator budget for key people (tokens)', group: 'Key people', min: 0, feature: FEATURE,
                help: 'No upper limit. When those away need more, the ones returning soonest or whose story just moved are told first. Story Suite\'s overall budget (Settings → Tabs & Packs) still caps everything sent each reply.',
            },
        },
    },
    tabs: [],
    widgets: { [KEY_PEOPLE_WIDGET]: keyPeopleWidget },
};
