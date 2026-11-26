// Story Director v2, chronicle part: feature definitions, capabilities, and module part assembly.

import { threadOutcome } from '../thread-outcome.js';
import { applyFactionLine, applyWorldLine, edit, lasting, remove, rumor } from '../capture.js';
import { DIGEST, DIGEST_DEFAULTS, DIGEST_FEATURE, FULL_MAX, KEEP_MAX } from '../days.js';
import { BACKLOG_BUDGET, DIGEST_TAIL_BUDGET, NOTE, digestCommand, noteCommand } from '../digest.js';
import { conditionCommands } from '../conditions/commands.js';
import { worldEventsFeature } from '../conditions/feature.js';
import { conditionQueries } from '../conditions/queries.js';
import { conditionsHereQuery } from '../conditions/here-query.js';
import { directorCallsQuery } from '../conditions/director-calls.js';
import { CONDITIONS_SETTLE, settleConditions } from '../conditions/settle.js';
import { DAILY, dailyCommand } from '../world-daily/command.js';
import { CUE, cueCommand } from '../world-daily/cue-command.js';
import { LEARNED, learnedCommand } from '../world-daily/learned.js';
import { HOLDING, holdingCommand } from '../world-daily/holding.js';
import { LORE_OPEN, loreOpenCommand } from '../world-daily/lore-open.js';
import { worldBriefQuery } from '../world-daily/arc-brief.js';
import { anchorsQuery } from '../world-daily/anchors-query.js';
import { dailyAfterCapture } from '../world-daily/hook.js';
import { openAfterReceive } from '../world-daily/open-store.js';
import { WORLD_SEED, worldSeedCommand } from '../world-daily/seed.js';
import { OPEN, openCommand } from '../world-daily/open-store.js';
import { JUDGED, judgedCommand } from '../world-judge/judged.js';
import { initialChronicle, validateChronicle } from '../domain.js';
import { GRAMMAR, STATIC_TEXT, TAIL_BUDGET } from '../note.js';
import { SURFACE, surface } from '../pick.js';
import { queries } from '../queries.js';
import { chronicleScreen } from '../screen.js';
import { THREADS_FEATURE } from '../../../time/tracker/threads.js';
import { WORLD_EVENTS, WORLD_TEACHING } from '../capture/world-parts/switch.js';
import { beforeGenerate, tail } from './hooks.js';

/** The chronicle's optional mechanics (MODULES §F100). */
export const features = Object.freeze([
    Object.freeze({
        id: DIGEST_FEATURE,
        label: 'Day digest',
        describe: 'When a story day ends, code writes what it held (places, quests, money, NPC stages, world news and the day\'s other events) from the receipts, for the Journal on the World screen and a one-line reminder after a time skip.',
        default: true,
    }),
    worldEventsFeature,
]);

// The command owned by the feature: a handler with `feature` (Story Block refuses it while it is off).
const digestHandler = Object.assign((ctx, payload) => digestCommand(ctx, payload), { feature: DIGEST_FEATURE });
// The note keeps the quest history too, so it is not under the digest feature (it skips the day facts while that is off).
const noteHandler = ctx => noteCommand(ctx);
// The pick of the open events for the next reply's [World] lines is the threads feature's: with it off nothing is picked or written.
const surfaceHandler = Object.assign((ctx, payload) => surface(ctx, payload), { feature: THREADS_FEATURE });

/** What a pack's `requires.capabilities` can name: Story Director can write a pack event's lasting change (`chronicle.lasting`). */
export const capabilities = Object.freeze(['chronicle-lasting']);

export const part = {
    features,
    capabilities,
    domains: {
        // `dayFacts` and `seenAt` are per-reply bookkeeping (SPEC §2.2 scratch): an entry whose holder a deleted reply made is replayed all the same.
        // `round` counts the picks: a deleted pick takes its +1 away, later picks add theirs (counters, `was`).
        chronicle: { initial: initialChronicle, validate: validateChronicle, scratch: ['dayFacts', 'questLog', 'seenAt', 'worldLine'], counters: ['round'] },
    },
    commands: {
        'chronicle.threadOutcome': threadOutcome,
        'chronicle.edit': edit,
        'chronicle.remove': remove,
        'chronicle.lasting': lasting,
        // The World pulse's news (pulse/effects.js): a looming world event, written by code before a reply.
        'chronicle.rumor': rumor,
        ...conditionCommands,
        [CONDITIONS_SETTLE]: settleConditions,
        [DAILY]: dailyCommand,
        [CUE]: cueCommand,
        [LEARNED]: learnedCommand,
        [HOLDING]: holdingCommand,
        [LORE_OPEN]: loreOpenCommand,
        [WORLD_SEED]: worldSeedCommand,
        [OPEN]: openCommand,
        [JUDGED]: judgedCommand,
        [SURFACE]: surfaceHandler,
        [DIGEST]: digestHandler,
        [NOTE]: noteHandler,
    },
    queries: { ...queries, ...conditionQueries, 'chronicle.directorCalls': directorCallsQuery, 'chronicle.conditionsHere': conditionsHereQuery, 'chronicle.world.brief': worldBriefQuery, 'chronicle.world.anchors': anchorsQuery },
    // The world and faction lines are the threads feature's (src/v2/threads.js); `chronicle.lasting` (a pack event's step) is code's and stays.
    kinds: {
        world: { grammar: GRAMMAR.world, apply: applyWorldLine, feature: THREADS_FEATURE },
        faction: { grammar: GRAMMAR.faction, heads: ['+ faction', '~ faction', '- faction'], apply: applyFactionLine, feature: THREADS_FEATURE },
    },
    context: {
        // Both paragraphs (World lines, Under [World]) are the threads feature's: the module sends them as a context part under it.
        static: env => (env?.chronicle ? STATIC_TEXT : ''),
        staticFeature: THREADS_FEATURE,
        // The conditions field and the one-line rule (new text, the owner's approval pending): only with the world-events switch on.
        parts: [{ feature: WORLD_EVENTS, static: () => WORLD_TEACHING }],
        tail: view => tail(view),
        budget: TAIL_BUDGET + DIGEST_TAIL_BUDGET + BACKLOG_BUDGET,
    },
    // afterCapture: the world's clock fallback and daily step; afterReceive: the open templates' asking ahead from the stepped state
    // (switch story-director.world-events; nothing while it is off).
    hooks: { beforeGenerate, afterCapture: dailyAfterCapture, afterReceive: openAfterReceive },
    settings: {
        section: 'Chronicle',
        defaults: { ...DIGEST_DEFAULTS, tempo: '1', judge: false },
        // The While away threshold is the time part's: a jump that long is a time skip.
        // The longest jump is the tracker's: the world's long-skip note shows above it when it is under 14 days (world-daily/command.js).
        reads: { recapHours: 'time.recapHours', maxJump: 'tracker.maxJump' },
        schema: {
            // Shown only while the feature is on (Story Block 2 settings fields' `feature`, B-rxui-3).
            digestDays: { type: 'int', label: 'Day digest: whole days kept', min: 1, max: FULL_MAX, feature: DIGEST_FEATURE },
            digestKeep: { type: 'int', label: 'Day digest: days kept in all (older ones are dropped)', min: 1, max: KEEP_MAX, feature: DIGEST_FEATURE },
            // How fast the world moves (0.25-4, default 1; stored as text like the map's scales). Read by the daily step.
            tempo: { type: 'text', label: 'World tempo (0.25-4)', feature: WORLD_EVENTS },
            // Off by default: a story's new world line is used as written and the daily roll is code's alone. On, a new world line is heard as rumour until one
            // Quick call judges it (accept, reshape, refuse), and the likely or possible events tomorrow's roll will fire are judged once a day (one may be held back).
            judge: { type: 'bool', label: 'World events: the Director judges new world lines and tomorrow\'s events', help: 'A world event the story writes is heard as rumour until the Director has judged it: kept, reshaped, or refused as a false rumour. The events the world is about to roll may be held back a day, with a reason. Short calls on the Quick connection.', feature: WORLD_EVENTS },
            digestTail: { type: 'bool', label: 'Day digest: remind the story of the last day after a time skip', feature: DIGEST_FEATURE },
        },
    },
    tabs: [],
    // The day digests are read on the World screen's Journal (world/screen.js); the Days screen is gone.
    screens: [chronicleScreen],
};
