/* NPC State hosted Story Suite views (role: hosted-suite-views). What Delta reads from a Story Block v2 host and its modules while hosted:
   the host's clock, meters and scene, Story Director's living cast as the dossier views read them, the chat-head mark, and the
   relationship changes, secret events and hidden-note options Delta sends back, and the words for why no one shows as present. Built by runtime-entry.js once per module instance with the shared
   runtime state and the controller functions it calls. Bodies are moved from runtime-entry.js without change. */

import { sceneTargets } from '../core/core-merge-namesakes.js';
import { chatContext as getContext, markStands, refusedLooks, worth, relationshipChanges, replayScope, scanMoodNumbers, scopedAdapter } from '../calls/runtime-scan-helpers.js';
import { replyScanned } from '../calls/scan-context.js';
import { tieDayAt } from '../transcript/transcript.js';
import { normalizeRelationshipBaseline, isTerminalNpcDeath, npcMatchesLabel, storyMinuteText } from '../core/core.js';
import { storyBlockIsV2 } from '../npc-api/host-probe.js';
import { ownerTargets } from '../npc-api/dossier-target.js';
import { castView, findCastPerson, normalizeCast } from '../dossier/cast-dossier.js';
import { getSettings, setRpgProbe } from '../settings/runtime-settings.js';
import { createTargetNotes } from './runtime-hosted-parts/target-notes.js';
import { createAwayHosted } from './runtime-hosted-parts/away.js';
import { pageHandles } from './handles.js';

export function createHostedPart(rt, deps) {
    const { chatHydrationStatus, getChatKey, getChatState, latestMessageId, latestReplyIndex } = deps;
    // Meetings the host did not keep, `${chatKey}|${npcId}`: sent again with that person's next scan (forwardRelationshipChangesToHost).
    // meetTried / moodTried: the entry-missing repeat and the catch-up of a mood word kept from before the numbers existed are each tried once a session.
    const meetOwed = new Set(), meetTried = new Set(), moodTried = new Set();
    setRpgProbe(() => (suiteHosted() && rt.peopleAdapter?.hosted?.() ? rt.peopleAdapter.rpgOn?.() === true : false));

    // Set by adapter/timeline.js (announceHosted) while Delta is registered with a Story Block v2 host.
    function suiteHosted() {
        return pageHandles.hosted === true;
    }

    // (v2 meters, F81/F90) While hosted, Story Block's per-reply `npc` slice holds the meter values. Every
    // helper here is a no-op without a host: the records pass through untouched and nothing is sent.
    function adapterMeters() {
        const adapter = suiteHosted() && rt.peopleAdapter?.hosted?.() ? rt.peopleAdapter : null;
        const scope = replayScope();
        return adapter && scope ? scopedAdapter(adapter, scope.at, scope.sink) : adapter;   // a history replay reads Story Block as of its reply
    }
    // (v2) Story Suite's "Scan after every reply" switch (feature npc-state-delta.scan-every-reply, on by default).
    // Off, the automatic scan waits for three replies (or "Scan every" when larger), as in 1.7.4, and then reads every reply since the last scan. True without a host, or when
    // the host cannot answer: Delta alone scans as it always did. Manual scans never ask.
    function scanAfterEveryReply() {
        const adapter = adapterMeters();
        if (!adapter) return true;
        try { return adapter.scanEveryReply?.() !== false; } catch { return true; }
    }
    // (v2) Story Director's clock while hosted ({ minutes, calendar }), for calendar.js; null otherwise.
    // The story's date after reply `index` as the dossier writes it ("Icewane 27"), '' with no host clock (calendar.js setStoryDateAtSource).
    function hostedStoryDateAt(index) {
        try { return String(adapterMeters()?.storyDateText?.(index) ?? ''); } catch { return ''; }
    }
    function hostedStoryDayAt(index) {
        try { const day = adapterMeters()?.storyDayNumber?.(index); return Number.isInteger(day) ? day : null; } catch { return null; }
    }
    function hostedStoryClock() {
        const adapter = adapterMeters();
        if (!adapter) return null;
        try { return adapter.storyClock?.() ?? null; } catch { return null; }
    }
    // Delta's records with their relationship numbers, part-points and earned milestones read from the slice (views, the injection and a scan's copy).
    function hostedMeterView(npcs) {
        const adapter = adapterMeters();
        if (!adapter) return npcs;
        try { return adapter.sliceView(npcs) || npcs; } catch { return npcs; }
    }
    // The people the step has recorded as made (the slice's `cast`), met now with their entry, with no dossier standing for them
    // and not removed by the reader.
    function castList() {
        const adapter = adapterMeters();
        if (!adapter) return null;
        try {
            const answer = adapter.castAnswer?.();
            if (!Array.isArray(answer)) return null;
            const calendar = adapter.directorCalendar?.() ?? null;
            return normalizeCast(answer, minutes => storyMinuteText(minutes, calendar));
        } catch {
            return null;
        }
    }

    // The dossier view's cast data by dossier id ({ badge, packName, firstMet, goal, routine, lastHeard, where, doing }) for the
    // dossiers made from the cast; null with none. Story Director's answer adds the live path and "last heard" when it is there.
    function dossierCastViews(state) {
        const made = (state?.npcs || []).filter(npc => npc?.id && npc.castFrom?.key);
        if (!made.length) return null;
        const people = castList();
        const views = {};
        for (const npc of made) {
            const view = castView(npc, findCastPerson(people, npc.castFrom.key));
            if (view) views[npc.id] = view;
        }
        return Object.keys(views).length ? views : null;
    }

    // (v2) While hosted, Story Block's scene says who is here unless the reader keeps the scene in Delta
    // ("scene: mine"): the dossier injection, the Cast tab and the module's queries all follow its
    // `scene.present`, so the prompt never carries two different casts. Delta's stored presence is not
    // changed. Without a host, or when the scene cannot answer, Delta's own presence stands.
    function scenePresenceView(npcs) {
        const adapter = adapterMeters();
        if (!adapter || !Array.isArray(npcs) || !storyBlockIsV2()) return npcs;
        let names = null;
        try { names = adapter.scenePresent?.(); } catch { names = null; }
        if (!Array.isArray(names)) return npcs;
        const named = sceneTargets(npcs, names);   // (namesakes: ../core/core-merge-namesakes.js)
        const here = new Set([...named.ids, ...named.rest.map(ownerTargets(npcs)).filter(Boolean)].map(String));
        let changed = false;
        const out = npcs.map(npc => {
            // (C-1) The scene cannot bring a confirmed-dead NPC back on stage.
            const present = Boolean(npc?.id) && here.has(String(npc.id)) && !isTerminalNpcDeath(npc);
            if (Boolean(npc?.present) === present) return npc;
            changed = true;
            return { ...npc, present, worldActive: present ? false : Boolean(npc.worldActive) };
        });
        return changed ? out : npcs;
    }
    // (v2 World view) Who the story's scene lists as present now, for the scanner's dynamic context: only
    // while hosted with Story Block keeping the scene (as scenePresenceView) and only for a scan of the
    // head reply (the scene is the head's). Story Director's World view first, else Story Block's scene;
    // null otherwise, and the scanner prompt is then exactly as before.
    function scanScenePresent(messageId) {
        const adapter = adapterMeters();
        if (!adapter || !storyBlockIsV2()) return null;
        if (Number.isInteger(messageId) && messageId !== latestMessageId(true)) return null;
        try {
            const names = adapter.presentNow?.();
            return Array.isArray(names) && names.length ? names : null;
        } catch {
            return null;
        }
    }
    // What the dossier view reads from the host beside the dossiers: v2 meters and living-cast views.
    function dossierHostViews(state) {
        const meterViews = adapterMeters()?.dossierMeters?.(state.npcs) ?? {};
        const castViews = dossierCastViews(state);
        const storyDay = tieDayAt();   // the story day now: older ties fade by it (core-keyrel.js)
        return { meterViews, ...(Number.isInteger(storyDay) ? { storyDay } : {}), ...(castViews ? { castViews } : {}) };
    }
    // (perf) The dossiers as the views read them: a copy, except that a portrait's picture (its data URL, an immutable string of up to
    // a few hundred KB) is shared rather than copied; the portrait record itself is still a copy.
    function viewNpcCopies(npcs) {
        return (Array.isArray(npcs) ? npcs : []).map(npc => {
            const portrait = npc?.portrait;
            if (!portrait || typeof portrait !== 'object' || typeof portrait.dataUrl !== 'string') return structuredClone(npc);
            const copy = structuredClone({ ...npc, portrait: null });
            const { dataUrl, ...record } = portrait;
            copy.portrait = { ...structuredClone(record), dataUrl };
            return copy;
        });
    }
    // Story Director's people away (runtime-hosted-parts/away.js): the "While away" note, the scan hold and their dossier ids.
    const { awayReturnNotes, awayScanOptions, awayKeepIds } = createAwayHosted(rt, { getChatKey, latestReplyIndex, adapterMeters });
    // The ids of followed dossiers (the Follow star) and of those away now: the stale pass archives, never deletes, them.
    function keyKeepIds(state) {
        return [...new Set([...(state?.npcs || []).filter(npc => npc?.followed === true).map(npc => npc.id), ...awayKeepIds(state)])];
    }
    // True while hosted and a read really failed: the away list (a present query that errors or answers a non-list; Story Director absent is
    // no list, not a failure) or the meter read. The stale pass then only archives.
    function hostedReadsFailed() {
        const adapter = adapterMeters();
        if (!adapter) return false;
        try { return adapter.awayReadable?.() === false || !Array.isArray(adapter.meterEntries?.()); } catch { return true; }
    }
    // The chat state a scan works from: with the slice's relationship numbers while hosted (a copy;
    // the stored state is never changed here), the state itself otherwise.
    function hostedScanState(state) {
        const npcs = hostedMeterView(state?.npcs);
        return npcs === state?.npcs ? state : { ...state, npcs };
    }
    // Which message is the head of the chat, and which of its swipes is shown. Story Block writes a
    // module's command onto its head reply, so a scan's changes may go there only while it is the head
    // the scan started from: the same message object at the same place with the same swipe.
    function chatHeadMark() {
        const chat = getContext().chat || [];
        const message = chat[chat.length - 1] ?? null;
        return { length: chat.length, message, swipe: Number.isInteger(message?.swipe_id) ? message.swipe_id : null };
    }
    function chatHeadUnchanged(mark) {
        if (!mark) return true;
        const now = chatHeadMark();
        return now.length === mark.length && now.message === mark.message && now.swipe === mark.swipe;
    }
    // A committed scan's relationship changes go to the slice as npc.adjust (same clamps as a story
    // line), in dossier order; the sidecar keeps its own numbers by v1's rules. `head` (chatHeadMark,
    // taken when the scan started): when the reader swiped, or a reply was added or deleted, since
    // then, nothing is sent; the changes belonged to a reply that is no longer the one Story Block
    // would write them on, and the reply now shown gets its own scan.
    function forwardRelationshipChangesToHost(before, after, messageId, head = null, updates = [], rows = [], onePass = false) {
        if (replayScope()) return;   // Story Block already holds these changes in its own per-reply records
        const adapter = adapterMeters();
        if (!adapter) return;
        const dropped = () => console.info('[NPC State] the chat moved on during the scan (a swipe or a new or deleted reply); its relationship changes were not sent to Story Suite.');
        if (!chatHeadUnchanged(head)) return dropped();
        const prior = new Map((before || []).map(npc => [npc?.id, npc]));
        const changes = relationshipChanges(prior, after, normalizeRelationshipBaseline(getSettings().relationshipBaseline), messageId, onePass ? rows : null);
        // A person's look set for the first time by this scan: its day and reply are stamped (the notes feature's locked look).
        const looks = (after || []).filter(npc => npc?.id && !npc.archived && String(npc.overallAppearance ?? '').trim() && !String(prior.get(npc.id)?.overallAppearance ?? '').trim());
        const refused = refusedLooks(prior, after, updates, rows);
        // (scan-admitted people) A dossier the scan made (an id the sidecar did not have) gets a slice entry the way a cast meeting gives one;
        // an adjust below has made it first when the scan moved its meters, and the meeting then only adds the mood and drives (`worth`: not the dead or incidental).
        // A meeting the host refused ("waiting: a native change is finishing", run 3) is owed and sent again with the next scan of that person; so is a
        // person this scan touched whose slice entry is still missing (a meeting lost with the page). Only people a scan returns; the rest are left as they are.
        const entries = typeof adapter.meterEntries === 'function' ? adapter.meterEntries() : null;
        let holds = null;   // (built once, on the first person asked about)
        const hasEntry = npc => !Array.isArray(entries) || Boolean((holds ??= adapter.meterHolders?.() ?? (held => adapter.meters?.(held.name)))(npc));
        const touched = npc => prior.get(npc.id)?.updatedAt !== npc.updatedAt;
        const owed = npc => touched(npc) && (meetOwed.has(`${getChatKey()}|${npc.id}`) || (!hasEntry(npc) && !meetTried.has(`${getChatKey()}|${npc.id}`)));
        const met = typeof adapter.meet === 'function' ? (after || []).filter(npc => npc?.id && !npc.archived && worth(npc) && (!prior.has(npc.id) || owed(npc))) : [];
        // A mood word the scan wrote (new or changed) gets its numbers in the slice (npc.mood): the three the scan gave (its row's moodV / moodA / moodD), else the fixed word list's, with the reason the scan recorded for the same reply. Not the dead or incidental extras; after the meeting.
        const moodOf = npc => String(npc?.mood ?? '').trim();
        const vadOf = npc => scanMoodNumbers(rows, npc, moodOf);
        const reasonOf = npc => (JSON.stringify(npc.lastRelationshipChange) !== JSON.stringify(prior.get(npc.id)?.lastRelationshipChange) ? String(npc.lastRelationshipChange?.reason ?? '').trim() : '');
        const moods = typeof adapter.mood === 'function' ? (after || []).filter(npc => npc?.id && !npc.archived && worth(npc) && moodOf(npc) && (moodOf(npc) !== moodOf(prior.get(npc.id)) || (touched(npc) && !moodTried.has(`${getChatKey()}|${npc.id}`)))) : [];
        // (drive growth) The before and after of a person who already had a dossier: the adapter reads what is new in them (memories, behavior,
        // mannerisms, the relationship reason) and the slice reads it for drive cues; a person the scan only just made has no earlier reply to count against.
        const grown = typeof adapter.drives === 'function' ? (after || []).filter(npc => npc?.id && !npc.archived && prior.has(npc.id)).map(npc => ({ id: npc.id, name: npc.name, before: prior.get(npc.id), after: npc })) : [];
        if (!changes.length && !looks.length && !refused.length && !met.length && !moods.length && !grown.length) return;
        void (async () => {
            // The slice entry comes first (adjust, else meet): a look flag never makes one, so a new person's look lock needs it.
            for (const change of changes) {
                if (!chatHeadUnchanged(head)) return dropped();
                await adapter.adjust({ ...change, guard: () => markStands(head) });
            }
            for (const npc of met) {
                if (!chatHeadUnchanged(head)) return dropped();
                const key = `${getChatKey()}|${npc.id}`;
                const out = await adapter.meet({ id: npc.id, name: npc.name, personality: npc.personality, about: npc.background, reply: messageId, guard: () => markStands(head) });
                meetTried.add(key);
                // Owed again when the host did not keep it (not REFUSED: nothing to add); taken, or no answer (no host), clears it.
                if (out?.ok === false && out.code !== 'REFUSED' && out.code !== 'NOT_FOUND') meetOwed.add(key);
                else meetOwed.delete(key);
            }
            for (const npc of moods) {
                if (!chatHeadUnchanged(head)) return dropped();
                moodTried.add(`${getChatKey()}|${npc.id}`);
                await adapter.mood({ id: npc.id, name: npc.name, word: moodOf(npc), vad: vadOf(npc), reason: reasonOf(npc), reply: messageId, again: moodOf(npc) === moodOf(prior.get(npc.id)), personality: npc.personality, about: npc.background, guard: () => markStands(head) });
            }
            for (const item of grown) {
                if (!chatHeadUnchanged(head)) return dropped();
                await adapter.drives({ id: item.id, name: item.name, before: item.before, after: item.after, reply: messageId, guard: () => markStands(head) });
            }
            for (const flag of [...looks.map(npc => ({ id: npc.id, name: npc.name, lock: true })), ...refused.map(item => (item.text ? { id: item.id, name: item.name, text: item.text } : { id: item.id, name: item.name, drift: { before: item.before, incoming: item.incoming, ...(item.swaps ? { swaps: item.swaps } : {}) } }))]) {
                if (!chatHeadUnchanged(head)) return dropped();
                await adapter.flag?.({ ...flag, reply: messageId, guard: () => markStands(head) });
            }
        })();
    }

    // (v2 hidden notes) The story events of present people's locked notes this scan should look for ([] when none): only for
    // a scan of the head reply (an opened note is recorded on the head), and only for the people in the scene now.
    function hostedEventWatch(state, messageId) {
        const adapter = adapterMeters();
        if (!adapter || (Number.isInteger(messageId) && messageId !== latestMessageId(true))) return [];
        try { return adapter.eventWatch?.(scenePresenceView(state?.npcs || [])) || []; } catch { return []; }
    }

    // (v2 hidden notes) What a scanner or one-pass prompt is asked about hidden notes while hosted: the layered notes for a new
    // dossier (setting) and the story events of present people's locked notes; {} when neither (the prompt is then as before).
    function hostedNotePromptOptions(state, settings, messageId = null) {
        if (!adapterMeters()) return {};
        const eventWatch = hostedEventWatch(state, Number.isInteger(messageId) ? messageId : undefined);
        return {
            ...(settings.layeredSecrets !== false ? { layeredSecrets: true } : {}),
            ...(eventWatch.length ? { eventWatch } : {}),
        };
    }

    const { hostedTargetNotes, targetNoteOptions } = createTargetNotes({ adapterMeters, hostedEventWatch });

    // A committed scan's `secretEvents` (the keys of the watched story events the current exchange showed) open those notes
    // as npc.open (cause ui, recorded on the head reply, so a swipe takes them back). Nothing is sent when the chat moved
    // on during the scan (as forwardRelationshipChangesToHost).
    function forwardSecretEventsToHost(watched, answered, head = null) {
        if (replayScope()) return;
        const adapter = adapterMeters();
        if (!adapter || !Array.isArray(watched) || !watched.length || !Array.isArray(answered) || !answered.length) return;
        if (!chatHeadUnchanged(head)) {
            console.info('[NPC State] the chat moved on during the scan; its story events were not sent to Story Suite.');
            return;
        }
        const keys = new Set(answered.map(item => String(item ?? '')));
        const people = new Map();   // by dossier id: two namesakes' notes are never merged
        for (const item of watched) {
            if (!keys.has(item.key)) continue;
            const who = item.id || item.name;
            const had = people.get(who) ?? { id: item.id, name: item.name, ids: [] };
            people.set(who, { ...had, ids: [...had.ids, item.note] });
        }
        if (!people.size) return;
        void (async () => {
            for (const person of people.values()) {
                if (!chatHeadUnchanged(head)) return;
                await adapter.openByEvent(person);
            }
        })();
    }

    // (v2 hidden notes) The layered notes a scan wrote for the dossiers it just built (`ids`), read from the rows the model
    // returned: 2 to 5 per person, cleaned, set once and never rewritten by a later scan. A dossier that already has notes
    // (the pack's, the reader's) keeps them. Returns how many dossiers got notes.
    function attachGeneratedSecrets(state, ids, ...sources) {
        const adapter = adapterMeters();
        if (!adapter || !Array.isArray(state?.npcs)) return 0;
        const rows = sources.flatMap(source => (Array.isArray(source?.npcs) ? source.npcs : []));
        let count = 0;
        for (const id of ids || []) {
            const npc = state.npcs.find(item => item?.id === id && !item.archived);
            if (!npc || (Array.isArray(npc.secrets) && npc.secrets.length)) continue;
            const row = rows.find(item => Array.isArray(item?.secrets) && item.secrets.length
                && (item.settledId ? item.settledId === npc.id : String(item.id || '') === npc.id || npcMatchesLabel(npc, String(item.name || ''))));
            let made = [];
            try { made = row ? adapter.generatedSecrets(row.secrets) : []; } catch { made = []; }
            if (!made.length) continue;
            npc.secrets = made;
            count += 1;
        }
        return count;
    }

    // (1.2.13) Why no NPC shows as present, in words, and whether a scan could change that.
    function castEmptyReason() {
        const key = getChatKey();
        if (key === 'no-chat') return { text: 'No chat is open.', scan: false };
        if (getSettings().enabled === false) return { text: 'NPC State is off.', scan: false };
        const hydration = chatHydrationStatus(key);
        // (R2-5) A sidecar that could not be read is not "still loading": say so, and where to fix it
        // (the settings section's roster, the same notice the drawer shows).
        if (hydration === 'error') {
            const detach = getSettings().dataFiles?.[key]?.path ? ' or Detach Broken Sidecar' : '';
            return { text: `This chat's dossiers could not be loaded, so nothing is shown and nothing is changed. NPC State's settings section has Retry Load${detach}.`, scan: false };
        }
        if (hydration !== 'ready') return { text: "This chat's dossiers are still loading.", scan: false };
        const state = getChatState(key);
        const latest = latestMessageId(true);
        if (!(state.npcs || []).some(npc => npc && !npc.archived)) {
            return { text: 'No NPC has a dossier in this chat yet, so nobody shows here even when the story or the World State names them. A scan of the latest reply makes dossiers for the NPCs in it.', scan: true };
        }
        if (latest >= 0 && !replyScanned(state, latest)) {
            return { text: 'The latest reply has not been scanned yet, so who is present is not known.', scan: true };
        }
        return { text: 'The latest scan found no NPC in the scene.', scan: true };
    }

    return { suiteHosted, adapterMeters, scanAfterEveryReply, hostedStoryClock, hostedStoryDateAt, hostedStoryDayAt, hostedMeterView, awayReturnNotes, castList, scenePresenceView, scanScenePresent, dossierHostViews, viewNpcCopies, awayScanOptions, keyKeepIds, hostedReadsFailed, hostedScanState, chatHeadMark, chatHeadUnchanged, forwardRelationshipChangesToHost, hostedNotePromptOptions, hostedTargetNotes, targetNoteOptions, forwardSecretEventsToHost, attachGeneratedSecrets, castEmptyReason };
}
