// The isolated relationship evaluator request for the target NPCs, in batches of four.
import {
    buildRelationshipPassPrompt,
    filterRelationshipDeltaByEvidence,
    isTerminalNpcDeath,
    normalizeScanNpc,
    npcMatchesLabel,
} from '../../core/core.js';
import { isScannerRoutingError } from '../../calls/scanner-routing.js';
import { RELATIONSHIP_RESPONSE_LENGTH, generateParsedNpcJson } from '../../calls/scanner-request.js';
import { currentExchangeRelationshipRelevant, rawScanMatchesExisting, hasCompletePrimaryRelationshipDecision } from './targets.js';

export async function runFocusedRelationshipPass(ctx, parsed, existingNpcs, transcript, settings, options = {}) {
    const returned = Array.isArray(parsed?.npcs) ? parsed.npcs : [];
    // (1.2.12) `prose`: the exchange's story alone. Who takes part is who it names (a name only in
    // the World State's lists, Off-Screen above all, is no part in the scene), and it is what the
    // evaluator reads; evidence is still checked against the whole exchange.
    const prose = String(options.prose ?? '').trim();
    const named = prose || transcript;
    // (1.2.12) A one-pass block's own word: `covered` (its rows hold everyone whose feelings could
    // have changed) settles anyone it left out; `review` names whom it wants checked anyway.
    const review = Array.isArray(options.review) ? options.review.map(name => String(name ?? '').trim()).filter(Boolean).slice(0, 8) : [];
    // Relationship reconciliation is keyed to the CURRENT exchange, not to whether the broad
    // dossier scanner happened to return a row. This prevents an NPC who acts early in a long
    // response from being skipped merely because the response ends with another cast/location.
    const targets = (Array.isArray(existingNpcs) ? existingNpcs : [])
        .filter(npc => !npc?.archived && !isTerminalNpcDeath(npc))
        .filter(npc => {
            if (review.some(name => npcMatchesLabel(npc, name))) return true;
            const raw = returned.find(item => rawScanMatchesExisting(item, npc));
            if (!currentExchangeRelationshipRelevant(npc, named, raw, options)) return false;
            if (raw) return !hasCompletePrimaryRelationshipDecision(raw, transcript);
            return options.covered !== true;
        });
    if (!targets.length) return { decisions: new Map(), used: false, responseChars: 0, retried: false, targetCount: 0 };

    const decisions = new Map();
    let responseChars = 0;
    let retried = false;
    let failed = false;
    for (let offset = 0; offset < targets.length; offset += 4) {
        const batch = targets.slice(offset, offset + 4);
        try {
            const relationshipPrompt = buildRelationshipPassPrompt({
                transcript: prose || transcript,
                targets: batch,
                userName: ctx.name1 || 'User',
                relationshipCriteria: settings.relationshipCriteria,
                impactCriteria: settings.relationshipImpactCriteria,
                relationshipCaps: settings.relationshipCaps,
                window: options.window === true,
            });
            const { parsed: relationshipParsed, raw, retried: batchRetried } = await generateParsedNpcJson(ctx, {
                systemPrompt: "You are NPC State Delta's isolated relationship evaluator. Use only the supplied targets and current exchange. Return only the requested JSON object.".replace(options.window === true ? /current exchange/ : /(?!)/, 'exchanges'),   // a window of exchanges says so; one exchange is unchanged
                prompt: relationshipPrompt,
                responseLength: RELATIONSHIP_RESPONSE_LENGTH,
                label: `relationship pass ${Math.floor(offset / 4) + 1}`,
                requestScope: options.requestScope,
            });
            responseChars += String(raw ?? '').length;
            retried ||= Boolean(batchRetried);
            for (const target of batch) {
                const rawDecision = (relationshipParsed.npcs || []).find(item => String(item?.id || '') === String(target.id) || (item?.name && npcMatchesLabel(target, item.name)));
                if (!rawDecision) continue;
                const deltaSource = rawDecision.relationshipDelta ?? rawDecision.relationship_delta;
                const hasFullDelta = deltaSource && typeof deltaSource === 'object'
                    && ['trust', 'affection', 'desire', 'tension'].every(key => Number.isFinite(Number(deltaSource[key])));
                if (!hasFullDelta) continue;
                const normalized = normalizeScanNpc(rawDecision);
                const requestedHasDelta = Object.values(normalized.relationshipDelta).some(value => value !== 0);
                const reasonPresent = Boolean(String(normalized.relationshipChangeReason || '').trim());
                const relationshipDelta = requestedHasDelta && reasonPresent
                    ? filterRelationshipDeltaByEvidence(normalized.relationshipDelta, normalized.relationshipEvidence, transcript)
                    : { trust: 0, affection: 0, desire: 0, tension: 0 };
                const hasNonZeroNormalizedDelta = Object.values(relationshipDelta).some(value => value !== 0);
                const relationshipImpact = hasNonZeroNormalizedDelta ? normalized.relationshipImpact : 'none';
                const rawSummary = rawDecision.relationshipSummary ?? rawDecision.relationship_summary;
                const explicitSummaryProvided = typeof rawSummary === 'string';
                const explicitSummary = explicitSummaryProvided ? String(rawSummary).trim().slice(0, 700) : '';
                const hasNonZeroDelta = Object.values(relationshipDelta).some(value => value !== 0);
                const needsTurningPointSummary = hasNonZeroDelta && ['major', 'extreme'].includes(relationshipImpact);
                const fallbackSummary = needsTurningPointSummary && !explicitSummary && normalized.relationshipChangeReason
                    ? `${target.name || 'This NPC'}'s relationship with the player changed ${normalized.relationshipImpact === 'extreme' ? 'fundamentally' : 'substantially'}: ${normalized.relationshipChangeReason}`.slice(0, 700)
                    : '';
                const relationshipSummary = explicitSummary || fallbackSummary;
                const relationshipSummaryDecisionProvided = explicitSummaryProvided || Boolean(fallbackSummary);
                decisions.set(target.id, {
                    relationshipDelta,
                    relationshipImpact,
                    relationshipEvidence: normalized.relationshipEvidence,
                    relationshipChangeReason: normalized.relationshipChangeReason,
                    relationshipSummary,
                    relationshipSummaryDecisionProvided,
                    context: transcript,
                });
            }
            const missing = batch.filter(target => !decisions.has(target.id));
            if (missing.length) {
                console.warn('[NPC State Delta] focused relationship pass omitted or malformed one or more target decisions.', {
                    targets: batch.map(npc => npc.id),
                    decided: batch.filter(npc => decisions.has(npc.id)).map(npc => npc.id),
                });
            }
        } catch (error) {
            if (isScannerRoutingError(error)) throw error;
            failed = true;
            console.warn('[NPC State Delta] focused relationship batch failed; retaining safe zero/primary output for that batch.', error);
        }
    }
    return { decisions, used: true, responseChars, retried, targetCount: targets.length, failed };
}
