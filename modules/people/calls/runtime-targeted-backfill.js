/* NPC State targeted backfill (role: targeted-backfill). The history backfill for one NPC and the queue
   of pending backfills. Split from runtime-targeted.js; bodies are moved without change. */

import { chatContext as getContext, awayFromReplay, replayScope, latestMessageId } from './runtime-scan-helpers.js';
import { isScannerRoutingError } from './scanner-routing.js';
import { automaticBackfillStillRelevant, backfillNeedsRequest } from './scan-context.js';
import { recentTranscript, recentUserDevelopmentContext, currentExchangeTranscript, currentExclusions, storyDayAt, storyDaysForTranscript, refreshMessageGate } from '../transcript/transcript.js';
import { IMPORTANT_MEMORY_LIMIT, DEFAULT_RELATIONSHIP, inferNpcIdentityKind, npcCurrentlyAbsentInText, buildBackfillPrompt, buildProfileRefreshPrompt, extractExplicitKeyRelationshipEdges } from '../core/core.js';
import { getSettings, effectiveCustomFieldNames } from '../settings/runtime-settings.js';
import { fillAllowed, FILL_MERGE_OPTION } from '../appearance/appearance-fill.js';
import { createTargetedScopePart } from './runtime-targeted-scope.js';
import { backgroundRuleOn, captureJournalEntry } from '../runtime/runtime-narration.js';
import { FILL_REASON } from '../meters/npc-lines-parts/fill-in.js';

const { backfillScanMatchesTarget, rowContradictsTarget, soleRowMayBeTarget, transcriptMentionsBackfillTarget, edgeTouchesResolvedTarget } = createTargetedScopePart();

export function createTargetedBackfillPart(rt, deps, { prepareCanonicalScanBase, scopeTargetedChannels }) {
    const { ensureChatStateLoaded, getChatKey, getChatState, hostedMeterView, hostedTargetNotes, isScanBusy, noteScanFailure, requireReadyChatMutation, runTargetedDossierPass, targetNoteOptions } = deps;

    // The live state a backfill that preserves it keeps: the record's own, whatever the model returned.
    function backfillLiveState(liveBefore, keptPresent) {
        return {
            present: keptPresent,
            worldActive: Boolean(liveBefore.worldActive) && !keptPresent,
            mood: liveBefore.mood || '',
            location: liveBefore.location || '',
            goal: liveBefore.goal || '',
            status: liveBefore.status || '',
        };
    }

    async function backfillNpcFromHistory(request, messageId = null, { automatic = false, retried = false, parallel = false, batch = null } = {}) {
        const settings = getSettings();
        const ctx = getContext();
        const chatKey = getChatKey();
        if (!request?.npcId || !request?.label || chatKey === 'no-chat') return false;
        try { await ensureChatStateLoaded(chatKey); } catch { return false; }
        if (getChatKey() !== chatKey || !requireReadyChatMutation('backfill a dossier', chatKey, { notify: false })) return false;
        if (isScanBusy(chatKey, { ignoreParallel: parallel })) return false;   // a sibling backfill of the same batch is no reason to stand down
        if (!await prepareCanonicalScanBase(chatKey, 'dossier backfill')) return false;
        // (timeline) The window is read from the messages the story stands on: the gate is asked first.
        await awayFromReplay(refreshMessageGate());   // a history replay's scope steps aside while the host answers (no-op live)
        if (getChatKey() !== chatKey) return false;
        const state = getChatState(chatKey);
        const existing = state.npcs.find(npc => npc.id === request.npcId);
        if (!existing) return false;
        // (FOLLOWREFRESH) A newly admitted person's one follow-up is read exactly like a Refresh (same prompt, same story window, so memories,
        // relationships, looks, tastes and open business come back as a Refresh gives them); the guards below (live state, scope, meters) stay the backfill's.
        const refreshLike = request.reason === 'new-admission';
        const transcript = recentTranscript(settings.scanDepth, refreshLike ? { messageIds: true } : undefined);
        if (!transcript) return false;
        const developmentSourceMessageIds = refreshLike ? [...transcript.matchAll(/^\[m(\d+)\]/gm)].map(match => Number(match[1])).filter(Number.isInteger) : [];
        if (automatic) {
            if (!automaticBackfillStillRelevant(request, existing, state.npcs, currentExchangeTranscript(request.requestedMessageId))) return true;
        } else if (!backfillNeedsRequest(existing, state.npcs)) {
            return true;
        }
        const notes = hostedTargetNotes(existing, { newDossier: request.reason === 'new-admission' || request.reason === FILL_REASON, messageId, ...(refreshLike ? { tastes: true } : {}) });
        // A newly met person's one backfill also fills the looks the story never gave (appearance-fill.js). A retry of it may too, while looks are
        // still wanted; a missed-participant repair and an established person never do. No extra call: the line rides on this request.
        const fillLooks = (request.reason === 'new-admission' || request.reason === FILL_REASON) && fillAllowed(existing, ctx.name1);
        const common = {
            transcript,
            userName: ctx.name1 || 'User',
            charName: ctx.name2 || 'Character',
            memoryCriteria: settings.memoryCriteria,
            customFieldNames: effectiveCustomFieldNames(settings),
            fillLooks,
            quoteFacts: request.reason === FILL_REASON,   // (NSD6: the fill-in of a stub quotes the story for each fact; no request has this reason until N7 queues it)
            ...targetNoteOptions(notes),
        };
        const prompt = refreshLike
            ? buildProfileRefreshPrompt({
                ...common,
                fillBackground: true, // The new admission's one follow-up fills a grounded blank, never a locked or established background.
                backgroundRule: backgroundRuleOn(Boolean(replayScope()), replayScope() && captureJournalEntry(replayScope(), ctx.chat || [], request.requestedMessageId)),
                targetNpc: hostedMeterView([existing])[0],
                turn: Number.isInteger(state.turn) ? state.turn : null,
                storyDay: storyDayAt(latestMessageId(true)),
            })
            : buildBackfillPrompt({ ...common, targetName: request.label, existingNpc: existing });
        return runTargetedDossierPass({
            chatKey, ctx, prompt, messageId, notes, captureMessageId: request.requestedMessageId,
            id: request.npcId,
            label: `backfill for ${request.label}`,
            systemPrompt: "You are NPC State Delta's isolated dossier backfill scanner. Use only the supplied scanner payload. Return only the requested JSON object.",
            indicator: 'backfill',
            parallel,
            retry: () => retried ? false : backfillNpcFromHistory(request, messageId, { automatic, retried: true, parallel, batch }),   // (REFRESHCANCEL) only its target changed
            staleLabel: 'dossier backfill',
            checkpoint: 'dossier-backfill',
            metricsLabel: 'dossier-backfill',
            onStale: () => console.info('[NPC State] discarded stale dossier backfill after chat or dossier state changed.'),
            scope: (parsed, { latest, liveBefore }) => {
                const roster = latest.npcs;
                const target = liveBefore || { id: request.npcId, name: request.label, aliases: [], identityKind: inferNpcIdentityKind(request.label) };
                const returned = Array.isArray(parsed.npcs) ? parsed.npcs : [];
                // The backfill prompt is single-target by construction. If the model expands a short
                // label (e.g. Toris -> Toris Vale) without repeating the alias, accept the sole result
                // when the requested target is actually present in the supplied history.
                const labels = [request.label, ...(liveBefore ? [liveBefore.name, ...(liveBefore.aliases || [])] : [])];
                let matches = returned.filter(npc => backfillScanMatchesTarget(npc, request));
                if (!matches.length && returned.length === 1 && transcriptMentionsBackfillTarget(transcript, request.label)
                    && soleRowMayBeTarget(returned[0], { npcId: request.npcId, labels }, roster)) matches = returned;
                matches = matches.filter(row => !rowContradictsTarget(row, target, roster));
                const preserved = request.preserveLiveState === true ? liveBefore : null;
                // A missed-participant repair exists because the NPC takes part in the current exchange;
                // the broad scan's omission is not evidence of absence, so a grounded present=true stands.
                // Other repairs keep the live presence (older history must not make an NPC present).
                const repairedPresence = request.reason === 'missed-participant' && matches[0]?.present === true
                    && !npcCurrentlyAbsentInText(existing, currentExchangeTranscript(request.requestedMessageId));
                const keptPresent = preserved ? (repairedPresence || Boolean(preserved.present)) : false;
                parsed.npcs = matches.slice(0, 1).map(npc => ({
                    ...npc,
                    id: request.npcId,
                    // (C-3) The same live state the merge result keeps below, so the merge sees no change.
                    ...(preserved ? backfillLiveState(preserved, keptPresent) : {}),
                    relationshipImpact: 'none',
                    relationshipDelta: { trust: 0, affection: 0, desire: 0, tension: 0 },
                    relationshipChangeReason: '',
                }));
                if (!parsed.npcs.length) {
                    const literalMention = transcriptMentionsBackfillTarget(transcript, request.label);
                    console.warn('[NPC State] targeted backfill returned no accepted NPC', { target: request.label, literalMention, returnedCount: returned.length });
                    if (!request.silent) globalThis.toastr?.warning?.(`NPC State: ${request.label} was added, but the backfill model returned no matching dossier details from the last ${settings.scanDepth} messages.`);
                    return { ok: false, result: false };
                }
                // A single-target backfill may change only its target, in every result channel: profile
                // updates and social edges for other dossiers are dropped like their npc rows.
                scopeTargetedChannels(parsed, target, roster);
                // A Refresh also adds the ties the story window states outright.
                let localEdges;
                if (refreshLike) {
                    localEdges = extractExplicitKeyRelationshipEdges(transcript, roster, currentExclusions()).filter(edge => edgeTouchesResolvedTarget(edge, target, roster));
                    parsed.keyRelationshipEdges = [...parsed.keyRelationshipEdges, ...localEdges];
                }
                return { ok: true, preserved, keptPresent, repairedPresence, localEdges };
            },
            mergeOptions: {
                // The backfill prompt asks for up to five memories (a first, whole dossier).
                memoryInputLimit: IMPORTANT_MEMORY_LIMIT,
                allowTargetedDurableSeed: true,
                ...(fillLooks ? { [FILL_MERGE_OPTION]: true } : {}),
                ...(refreshLike ? { developmentSourceMessageIds, storyDays: storyDaysForTranscript(transcript) } : {}),
                developmentContext: transcript,
                userDevelopmentContext: recentUserDevelopmentContext(settings.scanDepth, { messageIds: true }),
            },
            afterMerge: (finalNpc, { scoped }) => {
                const { preserved, keptPresent, repairedPresence } = scoped;
                if (!preserved) return;
                Object.assign(finalNpc, backfillLiveState(preserved, keptPresent));
                finalNpc.seenCount = Number(preserved.seenCount || 0);
                // (a new person's fill-in: they were in the reply that made them, so they are seen then, present or not)
                finalNpc.lastSeenTurn = repairedPresence || request.reason === FILL_REASON
                    ? Math.max(Number(preserved.lastSeenTurn || 0), Number(state.turn || 0))
                    : Number(preserved.lastSeenTurn || 0);
                finalNpc.lastWorldActiveTurn = Number(preserved.lastWorldActiveTurn || 0);
                if (refreshLike) {   // the meters are never this pass's (as a Refresh)
                    finalNpc.relationship = structuredClone(preserved.relationship || DEFAULT_RELATIONSHIP);
                    finalNpc.lastRelationshipChange = structuredClone(preserved.lastRelationshipChange || finalNpc.lastRelationshipChange);
                }
            },
            onDone: savedNpc => {
                if (batch) { if (!request.silent) batch.done.push(savedNpc?.name || request.label); }   // the queue says it once for the batch
                else if (!request.silent) globalThis.toastr?.success?.(`NPC State: backfilled ${savedNpc?.name || request.label} from recent story context.`);
                return true;
            },
            onError: error => {
                noteScanFailure('dossier backfill', error, getChatKey());
                if (request.reason === FILL_REASON) request.lastError = error?.jsonFailed ? 'json' : 'call';   // (fillPolicy: a call error gets one queue retry)
                if (error?.code === 'NPC_SCANNER_ROUTE_CANCELLED' || error?.code === 'NPC_SCANNER_ROUTE_TIMEOUT') return null;
                // (a stub's fill-in tells the reader once, when the queue gives it up: fillFailureNote)
                if (request.reason !== FILL_REASON && (!request.silent || (isScannerRoutingError(error) && error.code !== 'NPC_SCANNER_ROUTE_CANCELLED'))) globalThis.toastr?.warning?.(`NPC State backfill failed for ${request.label}: ${error?.message || error}`);
                return false;
            },
        });
    }

    return { backfillNpcFromHistory };
}
