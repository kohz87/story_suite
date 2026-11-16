// Assembles the `npc` part: commands (on the people domain's bonds), queries, change-line kinds, prompt context and settings.
import { NPC_KIND, MILESTONE_KIND, CONTEXT_BUDGET, FEATURE_STAGES, FEATURE_DRIFT, FEATURE_MOOD_PULL, FEATURES, isObject } from '../npc-meters-config.js';
import { SETTINGS_DEFAULTS, SETTINGS_SCHEMA } from '../npc-meters-schema.js';
import { createNpcCommands } from '../npc-meters-commands.js';
import { createNpcQueries } from '../npc-meters-queries.js';
import { createNpcPrompt } from '../npc-meters-prompt.js';
import { noteKinds } from '../npc-notes-kinds.js';
import { createNpcReaders } from './readers.js';
import { createNpcRecords } from './records.js';
import { createNpcRun } from './run.js';
import { folded, foldedCommands } from './fold.js';
import { withStubs } from '../npc-lines-parts/stub.js';
import { withMemories, memoryLine } from '../npc-lines-parts/memory.js';
import { secretLine } from '../npc-lines-parts/secret.js';


/**
 * The `npc` part (MODULES §A part shape): commands, queries (the meters are the people domain's `bonds`, see ./fold.js), the `npc` and `milestone`
 * change-line kinds and the prompt context. Hooks (each optional, each may throw — a throw reads as
 * "nothing known"):
 *   resolve(name)     → Delta's dossier for that name or alias: { id?, name, aliases, relationship } | null (id: its npc_ id, the key of its meters)
 *   baseline()        → Delta's base relationship values (new NPCs start there)
 *   caps()            → Delta's impact-tier caps { ordinary, meaningful, major, extreme } (a story line's step is held to its tier's)
 *   allowance()       → the reader's events per story day { ordinary, meaningful, major, extreme } (null: no limit; relationship-pacing.js)
 *   calendarOwn()     → true while the reader keeps the calendar in Delta (then there is no story day to count on)
 *   startTime(index)  → story-clock minutes before that reply (null when unavailable)
 *   startDate(index)  → that story day as the dossier writes it ("Goldwane 13"; '' when unavailable)
 *   secretRules(name) → that dossier's notes as [{ id, meter?, at?, when?, title? }] (never their text)
 *   secretTexts(name, ids) → [{ id, text }] for those notes (the tail and screens only)
 *   setup(name, labels) → that dossier's meter setup { track, limits } (the editor's)
 *   presets()         → the preset catalog (presetCatalog: built-ins and packs')
 *   feature(id)       → true / false for a feature the host knows; anything else: its default
 *   present()         → names of the NPCs present now
 *   settings()        → the module's stored settings (queries and the prompt; commands use ctx.settings)
 *   ownCommand(type, payload) → true while Delta's own adapter is sending exactly this command (its
 *                       scanner's npc.adjust, its tick); a button, screen or pack cannot make it true
 *   linesMode()       → true while the one-pass lines switch is on (N7 turns it on): `+ npc` stubs and the unknown-person rule (npc-lines-parts/stub.js); off by default
 *   playerNames()     → the player's and the played character's names (a stub is never made for them)
 *   headReply()       → the index of the latest reply (the reader's own values start its window)
 */
export function createNpcPart(hooks = {}) {
    const readers = createNpcReaders(hooks);
    const {
        call, resolve, baseline, tierCaps, rulesFor, presentNames, featureOn, catalog, normalized,
        storedSettings, tierAllowance, clockDay, clockMinutes, timeMinutes, defsFrom, readerAction, ownOrModule, headReply, commandReply, setupFor,
        ownRungs, rungsFor, limitsFor,
    } = readers;
    const records = createNpcRecords(readers);
    const { identify, ensure, note, changesFrom, settleRecord, openCloseNotes, tiered } = records;
    const { run } = createNpcRun({ ...readers, ...records });

    const shared = {
        call, resolve, baseline, tierCaps, rulesFor, presentNames, featureOn, catalog, normalized,
        storedSettings, tierAllowance, clockDay, clockMinutes, timeMinutes, defsFrom, readerAction, ownOrModule, headReply, commandReply, setupFor,
        ownRungs, rungsFor, limitsFor, identify, ensure, note, changesFrom, settleRecord,
        openCloseNotes, tiered, run, hooks,
    };
    const built = createNpcCommands(shared);
    // The meters live in the people domain's `bonds` (./fold.js): every command and change line runs on them as its `npc` slice.
    const commands = foldedCommands(built.commands);
    // `+ npc` stubs and the unknown-person rule: only while lines mode is on (hooks.linesMode; off, nothing differs).
    const linesMode = () => call(hooks.linesMode, false) === true;
    const date = at => (clockDay(at) === null ? '' : call(hooks.startDate, '', at));
    const captureLine = folded(withMemories(withStubs(built.captureLine, { hooks, linesMode, baseline, note }), { linesMode, date }));
    // `~ memory` and `~ reveal` (NSD8, NSD12): only in lines mode; untaught until N7 (grammar '', heads only). Off, a line of either is refused and changes nothing.
    const onlyLines = (name, apply) => folded((ctx, line = {}) => (linesMode(ctx) ? apply(ctx, line) : ctx.fail('REFUSED', `${name} lines are not on.`)));
    const memoryApply = onlyLines('~ memory', (ctx, line) => memoryLine(ctx, line, { date }));
    const secretApply = onlyLines('~ reveal', (ctx, line) => secretLine(ctx, line, { identify, rulesFor, run }));
    // The host sends every line of the module to the one apply of the `npc` kind: `~ memory` and `~ reveal` go to their own, the rest to the change line.
    const dispatch = (ctx, line = {}) => (line.kind === 'memory' ? memoryApply(ctx, line) : line.kind === 'reveal' ? secretApply(ctx, line) : captureLine(ctx, line));
    const { queries, ladderView, notesView, sliceOf, presentKeys } = createNpcQueries(shared);
    const { staticText, tail, redact } = createNpcPrompt(shared, { sliceOf, presentKeys });

    return {
        commands,
        queries,
        kinds: {
            [NPC_KIND]: { grammar: '~ npc Name | trust: +N | affection: -N', heads: ['~ npc', '+ npc'], apply: dispatch, after: ['time', 'present', 'place'] },
            [MILESTONE_KIND]: { grammar: '+ milestone Name — the turning point that just happened between you (once, when a bond changes for good; e.g. + milestone Person A — a promise was kept)', apply: captureLine, feature: FEATURE_STAGES, after: ['time'] },
            ...noteKinds(captureLine),
            memory: { grammar: '', heads: ['~ memory'], apply: memoryApply, after: ['time', 'present', 'place', 'npc', 'milestone', 'lie', 'know', 'taste', 'tie'] },
            reveal: { grammar: '', heads: ['~ reveal'], apply: secretApply, after: ['time', 'present', 'place', 'npc'] },
        },
        context: { static: staticText, tail, budget: CONTEXT_BUDGET },
        redact,
        settings: { defaults: { ...SETTINGS_DEFAULTS }, schema: SETTINGS_SCHEMA },
        features: FEATURES,
        featureOn: id => featureOn(id),
        identify: (npcs, label) => identify(npcs ?? {}, label),
        defs: () => defsFrom(storedSettings()),
        meterSettings: () => storedSettings(),
        /** True when Delta's per-reply tick has something to look at (a ladder, or a drifting meter). */
        tickWanted: () => {
            const settings = storedSettings();
            return (featureOn(FEATURE_STAGES) && Object.keys(settings.ladder).length > 0)
                || (featureOn(FEATURE_DRIFT) && settings.custom.some(def => def.drift))
                || featureOn(FEATURE_MOOD_PULL);
        },
        ladder: record => (isObject(record) ? ladderView(record, storedSettings(), defsFrom(storedSettings())) : null),
        notes: record => (isObject(record) ? notesView(record, defsFrom(storedSettings())) : { locked: [], opened: [] }),
    };
}
