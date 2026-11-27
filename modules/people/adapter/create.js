// The adapter's factory: builds the parts (queries, cast UI, timeline, connect, editor, people sync) on shared state and returns the adapter object.
//
// Story Suite v2 adapter (Story Block 2, docs/v2/SPEC.md §6 and MODULES.md §D in Story Block).
//
// NPC State stays a standalone engine: its storage, capture, prompts and history rules are
// its own and nothing here changes them. When a Story Block v2 host is on the page, Delta also
// registers as module `npc-state-delta` with read-only queries, a Dossiers tab (id `cast`, the tab once
// called Cast) that is the dossier browser (and the same Dossiers as a screen in Story Block's game view),
// and a settings section that carries Delta's own settings panel into the Story Suite overlay. The present
// cast's cards are on Story Director's World screen (World → Now → Here) when it is there, drawn by Delta
// through the cast API handle (runtime/handles.js castApi); without Story Director they stay
// at the top of Dossiers (Story Block MODULES §F119). It also owns one small domain, `npc` (src/npc-meters.js; F81, F90): each NPC's
// meters, stages and unlocked hidden notes in the per-reply state, so they swipe and delete back
// with the replies. While hosted that slice is the truth for meter values: runtime-entry.js reads it back
// through sliceView() for the dossier view and the injection, and sends its scanner's relationship
// changes as `npc.adjust` (adjust()); the `~ npc` change line, an NPC card under each reply and the
// meters beside the present cast's cards come from here. While hosted, the copy in SillyTavern's extensions drawer is
// hidden; if the host goes away it comes back exactly where it was. While hosted, the handle also carries
// pageHandles.hosted, which runtime-entry.js reads (in-chat cast default, sidecar checks).
//
// Without a v2 host (no Story Block, or a v1 Story Block whose global has no `ready`/`sdk`) this
// module does nothing: it looks for the host once and then stops. The v1
// handshake is gone (B4-2); this adapter sends V2_HOST_EVENT when it registers and when the host goes away so the
// in-chat cast can follow.
//
// Finding the host: Story Suite's entry (index.js) starts the host first and this part after it, so the adapter looks at
// `globalThis.StoryBlock` once (no waiting) and, once it has `ready` (or `sdk`), waits on that promise. Going away: every 5 s,
// while hosted, it checks that `globalThis.StoryBlock` is still the host it registered with; when it is not, the drawer copy is
// restored and it looks again.
//
// Pure apart from the DOM it is given: no SillyTavern import, and every outside thing (Delta's
// runtime api, the host global, the document, timers) is injectable for tests.
//
// The factory is cut into parts under adapter/ (queries, cast-ui, timeline, connect, editor). Each part is a factory that gets
// the shared state (`session`: the lets more than one part uses) and `deps` (the options, the constants in adapter/names-*.js and the
// parts built before it). This file is the assembly of the parts and the adapter object they make.

import { escapeHtml } from '../util/html.js';
import { pageHandles } from '../runtime/handles.js';
import { createQueriesPart } from './queries.js';
import { createPeopleSync } from './people-sync.js';
import { peopleView, peopleState, peopleCarry } from '../view.js';
import { hashJson } from './hash.js';
import { queueNewStubFills } from './stub-fills.js';
import { keepStampContainers } from '../keep-containers.js';
import { createNativeDeath } from './native-death.js';
import { createCastUiPart } from './cast-ui.js';
import { createTimelinePart } from './timeline.js';
import { createConnectPart } from './connect.js';
import { createEditorPart } from './editor.js';
import { FEATURE_NOTES, FEATURE_SCAN_EVERY_REPLY, secretsToLines, secretsFromLines, normalizeGeneratedSecrets } from '../meters/npc-meters.js';
import { driveEvidence } from '../notes/npc-notes-drives.js';
import { lookDrift, lookFlagWording } from '../notes/npc-notes-look.js';
import { HOST_ALIVE_MS, HOST_RETRY_ATTEMPTS, HOST_RETRY_MS, V2_HOST_EVENT } from './names-host.js';
import { HEAD_SETTLE_MS, HEAD_SETTLE_POLL_MS, SECTION_WATCH_MS } from './names-waits.js';
import { MODULE_ID, MODULE_NAME, PRESET_KIND, RPG_FEATURE } from './names-module.js';
import { CAST_TAB_ID, DOSSIERS_ICON, DOSSIERS_TITLE, PAGE_SLOT_CLASS } from './names-tab.js';
import { CAST_SCREEN_ID, CAST_SCREEN_ORDER, CAST_WIDGET, WORLD_FEATURE } from './names-screen.js';
import { TICK_TURNS } from './names-api.js';

// Used only if dossier-rows.js cannot be loaded: the same empty line, without the Scan button.
const fallbackEmptyCast = reason => `<div class="ppl-story-empty-state"><p class="ppl-story-empty">${escapeHtml(reason?.text || 'No NPC is present in the latest scene.')}</p></div>`;

/**
 * The adapter. Options (all optional except in tests):
 *   suiteApi   Delta's v1 suite api (runtime-entry.js SUITE_API): npcs() gives { id, name, aliases, present, archived }.
 *   delta      () => Delta's runtime api (pageHandles.deltaApi):
 *              castEmptyReason, getNpc, formPortraits, isEnabled, scan, addNpc.
 *   panelId    id of Delta's settings panel in the extensions drawer.
 *   version    Delta's version, for the module definition.
 *   host       () => the Story Block global.
 *   headReply  () => the index of the latest reply (the reader's own meter values start its window).
 *   castSync   async () => makes the dossiers of the cast people the step has just recorded (runtime-entry.js castSync), and gives a cast
 *              dossier made without its picture the picture once Story Block has it.
 *   castPortraitDue   () => whether castSync has a picture to give (a cheap look); the adapter asks before it runs the sync for that alone.
 *   doc, timers, loadEmptyCast (() => Promise<emptyCastHtml>), logger.
 */
export function createPeopleAdapter({
    suiteApi = null,
    delta = () => pageHandles.deltaApi,
    panelId = 'people_settings',
    version = '',
    host = () => globalThis.StoryBlock,
    headReply = () => null,
    castSync = null,
    castPortraitDue = null,
    doc = globalThis.document,
    timers = globalThis,
    loadEmptyCast = () => import('../dossier-rows.js').then(module => module.emptyCastHtml),
    retryMs = HOST_RETRY_MS,
    attempts = HOST_RETRY_ATTEMPTS,
    aliveMs = HOST_ALIVE_MS,
    watchMs = SECTION_WATCH_MS,
    logger = console,
    // True while the one-pass lines switch is on (N7: the production start-up passes true): `+ npc` stubs and the unknown-person rule (src/npc-lines-parts/stub.js). Off, nothing differs.
    linesMode = () => false,
    // True while the custom Level field is on (a configured field, or the host's RPG feature): a `~ npc` line may then state `level: N` (src/npc-lines-parts/level.js). Off, a `level:` label is an unknown one.
    levelOn = () => false,
    // Delta's dossier list markup (dossier-rows.js) for the Dossiers tab; its rows are the plain ones (adapter/cast-ui/dossier-list.js).
    loadDossierList = () => import('../dossier-rows.js').then(tabs => ({ rowNodes: tabs.dossierRowNodes })),
    // How long Delta waits for the host's head-selection barrier to come down, and how often it looks (messageGate.settled).
    settleMs = HEAD_SETTLE_MS,
    settlePollMs = HEAD_SETTLE_POLL_MS,
    // Delta's card settings (src/card-settings.js); registered with a Story Block that has sdk.registerCardSettings (2.21.0).
    cardSettings = null,
} = {}) {
    const session = {
        started: false,
        sdkRef: null,           // the sdk we registered with (once per sdk)
        hosted: false,
        emptyCast: fallbackEmptyCast,
        mounted: null,          // { el, node, placeholder, drawer } while the panel is in the overlay
        pendingSection: null,   // a section element waiting for the panel to mount
        castEl: null,           // the last element the Cast tab rendered into
        pending: null,          // the connection attempt in progress, if any
        refused: false,         // the host did not accept the module (or never became ready): nothing is held back for it
        baselineKey: null,      // the chat whose first loaded render was taken as the public paths' baseline
        offPublicPaths: null,   // unregisters Delta's public paths (npc.<name>.<meter>); `.changed()` tells the host the values moved
        lastTick: Promise.resolve(null),
        listParts: null,        // loadDossierList's { rowNodes, project, filter } once loaded
    };

    // The parts, in the order the closure declared them: each gets the options and constants (deps) and what the parts before it return.
    const deps = {
        suiteApi, delta, panelId, version, host, headReply, castSync, castPortraitDue, doc, timers, loadEmptyCast, retryMs,
        attempts, aliveMs, watchMs, logger, linesMode, levelOn, loadDossierList, settleMs,
        settlePollMs, cardSettings, MODULE_ID, MODULE_NAME, CAST_TAB_ID, DOSSIERS_TITLE, DOSSIERS_ICON, CAST_SCREEN_ID,
        CAST_WIDGET, CAST_SCREEN_ORDER, WORLD_FEATURE, PAGE_SLOT_CLASS, TICK_TURNS, PRESET_KIND,
        V2_HOST_EVENT,
    };
    // The queries part reads the npc.identity query when it is called; the timeline part is built after it.
    let timelinePartRef = null;
    deps.timeline = { get queries() { return timelinePartRef.timeline.queries; }, get catchUp() { return timelinePartRef.timeline.catchUp; } };
    const queriesPart = createQueriesPart(session, deps);
    Object.assign(deps, queriesPart);
    // The people live in the host's `people` domain: Delta's memory is a cache hydrated from it on every head move and chat load, and each change of
    // Delta's own is one `people.write` for the reply the cache stands on (a head that moved refuses it and the cache hydrates again).
    const peopleSync = createPeopleSync({
        sdk: () => session.sdkRef, view: peopleView, restore: peopleState, hash: hashJson, warn: text => queriesPart.warn(text),
        readState: () => queriesPart.runtime()?.getState?.() ?? null,
        install: keys => queriesPart.runtime()?.hydratePeople?.(keys) === true,
        ready: () => queriesPart.runtime()?.stateReady?.() !== false,
        chatKey: () => queriesPart.runtime()?.chatKey?.() ?? '',
        rescan: () => queriesPart.runtime()?.rescanLatest?.(),
        afterHydrate: at => {
            if (linesMode()) queueNewStubFills(queriesPart.runtime(), queriesPart.runtime()?.chatKey?.() ?? '', at);
        },   // the fill-in of a `+ npc` stub (NSD6)
        carry: peopleCarry,
        keep: (built, slice) => (linesMode() ? keepStampContainers(built, slice) : built),   // lines mode only: with the switch off the view is written as it is
        mark: (index, since) => queriesPart.runtime()?.setScanMarker?.(index, since),
        setRecord: record => queriesPart.runtime()?.setPeopleRecord?.(record) === true,
    });
    deps.peopleSync = peopleSync;
    // A death the host confirmed: stored as a people write for the head's reply (see src/adapter/native-death.js).
    const nativeDeath = createNativeDeath({
        sdk: () => session.sdkRef, peopleSync, identity: args => timelinePartRef.timeline.queries['npc.identity'](null, args),
        readState: () => queriesPart.runtime()?.getState?.() ?? null,
        setRecord: record => queriesPart.runtime()?.setPeopleRecord?.(record) === true,
    });
    const castUiPart = createCastUiPart(session, deps);
    Object.assign(deps, castUiPart);
    const timelinePart = createTimelinePart(session, deps);
    timelinePartRef = timelinePart;
    Object.assign(deps, timelinePart);
    const connectPart = createConnectPart(session, deps);
    Object.assign(deps, connectPart);
    const editorPart = createEditorPart(session, deps);
    Object.assign(deps, editorPart);
    const { watchers, pageApi, offerPage } = castUiPart;
    const { storyDateText, storyDayNumber, dossierOf, part, sliceEntries, entryFor, ownersNow, partyLevelsAnswer, awayAnswer, awayReadable, awayMemory, castAnswer, castPeople, castMade, packNames, placeName, packPortraitUrl, castGearLine, directorCalendar, send, sliceView, worldSecretsOn } = queriesPart;
    // What a command about a held dossier goes out under: its id (namesakes, a dead one beside a living one), when the stored or live dossiers have it;
    // else the name (for an id neither has, the host would make a person out of the id's text).
    const targetOf = (id, name) => (id && (ownersNow().has(id) || dossierOf(id)?.id === id) ? id : name);
    // Whose entry a send is about: that dossier (a dead or archived one by its stored record), else the one the name or stored id finds.
    const holderFor = (id, name, owners) => (id ? dossierOf(id) ?? owners.record(id) : null) ?? dossierOf(name) ?? owners.record(name) ?? { name };
    const entryOf = (id, name) => {
        const entries = sliceEntries();
        if (!entries) return null;
        const owners = ownersNow();
        return entryFor(entries, holderFor(id, name, owners), owners);
    };
    const { ownPrompt, storyClock, calendarLink, definition, scenePresentNames } = timelinePart;
    const { poll, unhost, check } = connectPart;
    const { editorHtml, readEditor, dossierMeters, eventWatch } = editorPart;

    return Object.freeze({
        definition,
        /** The catch-up after a fallback and the rebuild: status() for the banner, skip() (not a Story Block command: that would write an op), rebuild({ replies }). */
        catchUp: timelinePart.timeline.catchUp,
        /** The cast API Story Director's World screen uses (the handle's castApi). */
        pageApi,
        /** While hosted: Delta's scanner changes for one NPC → `npc.adjust` (a promise of the result, or null); `why`: a one-pass block's evidence per meter. */
        adjust: ({ id, name, meters, start, reply, impact, reason, why, guard } = {}) => send('npc.adjust', { name: targetOf(id, name), meters, ...(start ? { start } : {}), ...(Number.isInteger(reply) && reply >= 0 ? { reply } : {}), ...(typeof impact === 'string' ? { impact } : {}), ...(typeof reason === 'string' && reason.trim() ? { reason } : {}), ...(why && typeof why === 'object' ? { why } : {}) }, { own: true, background: true, guard }),
        /** While hosted: Delta's scan admitted a person → `npc.meet` (an entry with the dossier's meters, a resting mood and drives, like a cast meeting). */
        meet: ({ id, name, personality, about, reply, guard } = {}) => send('npc.meet', { name: targetOf(id, name), ...(Number.isInteger(reply) && reply >= 0 ? { reply } : {}), ...(personality ? { personality: String(personality).slice(0, 600) } : {}), ...(about ? { about: String(about).slice(0, 600) } : {}) }, { own: true, background: true, guard }),
        /** While hosted: Delta's scan wrote a new mood word for a person → `npc.mood` (its numbers: the three the scan gave, else the fixed word list; with the reason the scan recorded). */
        mood: ({ id, name, word, vad, reason, reply, again, personality, about, guard } = {}) => send('npc.mood', { name: targetOf(id, name), word: String(word ?? '').slice(0, 220), ...(vad ? { vad } : {}), ...(personality ? { personality: String(personality).slice(0, 600) } : {}), ...(about ? { about: String(about).slice(0, 600) } : {}), ...(again === true ? { again: true } : {}), ...(reason ? { reason: String(reason).slice(0, 200) } : {}), ...(Number.isInteger(reply) && reply >= 0 ? { reply } : {}) }, { own: true, background: true, guard }),
        /** While hosted: what a scan newly recorded for one person (plain strings) → `npc.drives` (drive growth, rule 1). Only with the notes feature on and for a person who already has meters; else null. */
        drives: ({ id, name, texts: given, before, after, reply, guard } = {}) => ((texts) => !texts.length || part.featureOn(FEATURE_NOTES) !== true || !entryOf(id, name) ? null
            : send('npc.drives', { name: targetOf(id, name), texts: texts.slice(0, 12).map(text => String(text).slice(0, 200)), rule: 1, ...(after?.role ? { ignore: String(after.role).slice(0, 120) } : {}), ...(Number.isInteger(reply) && reply >= 0 ? { reply } : {}) }, { own: true, background: true, guard }))(Array.isArray(given) ? given : driveEvidence(before, after)),
        /** While hosted: Delta's scan tells the slice a person's look was first set (`lock`) or contradicted (`drift: { before, incoming }`, worded by npc-notes-look.js; or `text`, `cue`) → `npc.flag`. Only with the notes feature on and for a person who already has meters (a flag never makes an entry); else null. */
        flag: ({ id, name, text: said, cue: told, lock, reply, drift, guard } = {}) => ((text, cue) => (!text && lock !== true ? null : part.featureOn(FEATURE_NOTES) === true && entryOf(id, name) ? send('npc.flag', { name: targetOf(id, name), ...(text ? { text } : {}), ...(cue ? { cue } : {}), ...(lock === true ? { lock: true } : {}), ...(Number.isInteger(reply) && reply >= 0 ? { reply } : {}) }, { own: true, background: true, guard }) : null))(said || (drift ? lookDrift(drift.before, { ...drift, name }) : ''), told || (drift ? lookFlagWording(name, drift.before) : '')),
        /** While hosted: the tastes a Refresh read (`tastes`: [{ sign, item, from }]) → `npc.taste`, recorded on `reply`. Only for a person who already has meters and with the notes feature on; else null. (A Refresh no longer sends tastes: it only reads them.) */
        tastes: ({ id, name, tastes, reply } = {}) => (part.featureOn(FEATURE_NOTES) === true && Array.isArray(tastes) && tastes.length && entryOf(id, name)
            ? send('npc.taste', { name: targetOf(id, name), tastes, ...(Number.isInteger(reply) && reply >= 0 ? { reply } : {}) }, { own: true, background: true }) : null),
        /** While hosted: the reader's own values from the dossier editor → `npc.set` (the host's latest reply; headReply). */
        setMeters: ({ id, name, meters } = {}) => send('npc.set', { name: targetOf(id, name), meters }),
        /** While hosted: stages and notes again for one NPC (after its notes were edited) → `npc.refresh`. */
        refresh: name => send('npc.refresh', { name }),
        /** While hosted: one NPC's slice entry (npc.meters), or null. */
        meters: name => entryOf(null, name),
        /** While hosted: for one pass over several dossiers, `npc => whether that held dossier has an entry` (the entries and owners read once). */
        meterHolders: () => {
            const entries = sliceEntries();
            if (!entries) return () => false;
            const owners = ownersNow();
            return npc => Boolean(entryFor(entries, npc, owners));
        },
        /** While hosted: Delta's records with numbers, part-points and earned milestones read from the slice (read time; nothing written). */
        sliceView,
        /** Runs the synchronous reads of `fn` against Story Block's state after reply `index` (query { asOf }); nothing is written or moved. */
        at: (index, fn) => {
            const real = session.sdkRef;
            if (typeof real?.query !== 'function') return fn();
            session.sdkRef = Object.create(real, { query: { value: (name, args) => real.query(name, { ...args, asOf: index }) } });
            try { return fn(); } finally { session.sdkRef = real; }
        },
        /** While hosted: Story Block's `party.levels` as it answers, or null (no host, no query, RPG off). */
        partyLevelsAnswer,
        /** While hosted: the slice's entries (npc.meters) at the head, or null when the host cannot answer. */
        meterEntries: sliceEntries,
        /** While hosted: Story Director's calendar (`director.calendar`), or null. */
        directorCalendar,
        /** While hosted: the story's date after reply `index` ("Icewane 27"), '' without a clock; dates a memory when it is recorded. */
        storyDateText,
        /** While hosted: the story day (whole days of Story Director's clock) after reply `index`, null without a clock; ties' last mention uses it. */
        storyDayNumber,
        /** While hosted: Story Director's people away (`director.away`) as it answers, or null when it cannot; whether that list can be trusted. */
        awayAnswer,
        awayReadable,
        /** While hosted: the memory of the last absences (npc.awayMemory), {} without one. */
        awayMemory,
        /** While hosted: Story Director's cast (`director.cast`) as it answers, or null when it cannot. */
        castAnswer,
        /** The same, cleaned (src/cast-dossier.js normalizeCast), dates written on Story Director's calendar. */
        castPeople,
        /** While hosted: the people a cast dossier was made for (npc.castMade), {} without one. */
        castMade,
        /** While hosted: packs' names by id. */
        packNames,
        /** While hosted: a pack place's name for its id (or name or alias), or ''. */
        placeName,
        worldSecretsOn,
        /** While hosted: a pack portrait's safe image URL, or null. */
        packPortraitUrl,
        /** While hosted: a pack cast member's "Gear: A, B" line for the narrator's entry, or ''. */
        castGearLine,
        /** While hosted: whether Story Block's RPG feature is on (the custom field "Level" then appears by itself). */
        rpgOn: () => session.hosted === true && part.featureOn(RPG_FEATURE) === true,
        /** While hosted: the "Scan after every reply" switch (runtime-entry.js asks before each automatic scan). */
        scanEveryReply: () => part.featureOn(FEATURE_SCAN_EVERY_REPLY) !== false,
        /**
         * Where the calendar in Delta's settings stands: 'story-director' (Story Director's calendar is the one in
         * use) or 'none' (no host, or no Story Director calendar).
         */
        calendarLink,
        /** While hosted: Story Director's clock, { minutes, calendar: { era, months, leapYears } }, or null. */
        storyClock,
        /** What Delta sends with the next reply under its own keys: [{ label, text }] (the `ownPrompt` hook). */
        ownPrompt,
        /** While hosted: the names in Story Block's scene (`scene.present`), or null when it cannot answer. */
        scenePresent: scenePresentNames,
        /**
         * While hosted: who is in the scene now, for the scanner: Story Director's World view
         * (`director.world.here` → `present`) when it answers, else Story Block's `scene.present`; null
         * when neither can answer. Both are optional: Delta alone (or Story Block alone) still works.
         */
        presentNow: () => {
            if (!session.hosted || typeof session.sdkRef?.query !== 'function') return null;
            const ask = name => {
                try { return session.sdkRef.query(name, {}); } catch { return undefined; }
            };
            const here = ask('director.world.here');
            const list = Array.isArray(here?.present) ? here.present : ask('scene.present');
            return Array.isArray(list) ? list.map(name => String(name ?? '').trim()).filter(Boolean) : null;
        },
        /** A dossier's hidden notes as editor lines, and editor lines back to notes (src/npc-meters.js). */
        secretLines: list => secretsToLines(list),
        parseSecrets: (text, previous) => secretsFromLines(text, previous),
        /** While hosted: the editor's v2 controls for a dossier (markup), and what they hold (readEditor). */
        editorHtml,
        readEditor,
        /**
         * While hosted, after the dossier was saved: the editor's milestones and custom meter values
         * go to the slice (npc.milestone, npc.set), then stages and notes are settled again (npc.refresh).
         */
        applyEditor: async (who, edits = {}) => {   // `who`: a name or id, or { id, name } of the saved dossier
            if (!session.hosted) return null;
            const name = typeof who === 'string' ? who : targetOf(who?.id, who?.name);
            if (edits.meters && Object.keys(edits.meters).length) await send('npc.set', { name, meters: edits.meters });
            if (edits.milestones) await send('npc.milestone', { name, add: edits.milestones.add ?? [], remove: edits.milestones.remove ?? [] });
            if (edits.noteStates) await send('npc.open', { name, open: edits.noteStates.open ?? [], close: edits.noteStates.close ?? [] });
            return send('npc.refresh', { name });
        },
        /** While hosted: the dossier view's v2 meters by dossier id ({} otherwise). */
        dossierMeters,
        /** The story events of present people's locked notes the scan should look for (see eventWatch); [] when none. */
        eventWatch,
        /** The record ID of the reply at message `index` (null when the host cannot say): what a reply's own work is keyed by. */
        replySid: index => { try { return session.hosted ? session.sdkRef.query('npc.replySid', { asOf: index }) ?? null : null; } catch { return null; } },
        /** The place names Story Director's Atlas knows (its `atlas.places` query), [] when it is not there or cannot answer: capitalised words that are places name no one (NSD16). */
        places: () => { try { const got = session.hosted ? session.sdkRef.query('atlas.places', {}) : null; return (Array.isArray(got) ? got : []).flatMap(place => [place?.name, ...(Array.isArray(place?.aliases) ? place.aliases : [])]).filter(name => typeof name === 'string' && name); } catch { return []; } },
        /** While hosted: a story event the scan saw opens these notes of one NPC → `npc.open` (Delta's own send). */
        openByEvent: ({ id, name, ids } = {}) => send('npc.open', { name: targetOf(id, name), open: ids, by: 'story' }, { own: true, background: true }),
        /** The notes a scan wrote for someone new, cleaned to 2 to 5 layers (src/npc-meters.js normalizeGeneratedSecrets). */
        generatedSecrets: list => normalizeGeneratedSecrets(list),
        /** While hosted: Delta's per-reply step now (the host's 'turn' event sends it on its own). */
        tick: () => send('npc.tick', {}, { own: true }),
        /** Resolves once the latest per-reply step has settled. */
        ticked: () => session.lastTick,
        /** Start looking for the host (idempotent). */
        start() {
            if (session.started) return;
            session.started = true;
            offerPage(true);
            poll(0);
        },
        /** Stop looking and give everything back (tests; a reload of Delta). */
        stop() {
            session.started = false;
            offerPage(false);
            watchers.clear();
            unhost();
        },
        check,
        /** A death the host confirmed (an `np_` identity, the event's id, the head it read): stored for the head's reply; `{ ok }` or the refusal. */
        confirmDeath: input => nativeDeath.confirmDeath(input),
        hosted: () => session.hosted,
        /** 'hosted' | 'pending' | false: whether the store holds the chat's state (see connect.js storeOwns). */
        storeOwns: connectPart.storeOwns,
        /** Resolves (true when it registered) once the latest connection attempt has settled. */
        settled: () => session.pending ?? Promise.resolve(false),
    });
}
