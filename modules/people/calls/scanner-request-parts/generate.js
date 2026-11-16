// One scanner request with JSON parsing, salvage and a single compact retry.
import { dispatchScannerRequest, scannerRoutingError } from '../scanner-routing.js';
import { parseScanJson } from '../../core/core.js';
import { JSON_RETRY_RESPONSE_LENGTH, compactRetryPrompt, isTruncatedScannerJsonError } from './retry.js';
import { salvageScannerJson } from './salvage.js';

// A reply with no JSON object at all is usually a provider/host message or a model refusal rather
// than broken JSON. Surface a short, whitespace-collapsed excerpt so the cause is visible; never the
// whole provider response.
const NON_JSON_REPLY_EXCERPT_CHARS = 200;
function nonJsonReplyExcerpt(raw) {
    if (raw && typeof raw === 'object') return '';
    const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
    if (!text || text.includes('{')) return '';
    return text.length > NON_JSON_REPLY_EXCERPT_CHARS ? `${text.slice(0, NON_JSON_REPLY_EXCERPT_CHARS)}…` : text;
}

export async function generateParsedNpcJson(ctx, {
    systemPrompt,
    prompt,
    responseLength,
    label = 'scanner',
    requestScope,
}) {
    if (!requestScope) throw scannerRoutingError('A scanner request needs an owning operation.', 'NPC_SCANNER_ROUTE_CANCELLED');
    const invoke = async (retry = false, retryReason = 'malformed') => {
        const raw = await dispatchScannerRequest(ctx, {
            systemPrompt,
            prompt: retry ? compactRetryPrompt(prompt, label, retryReason) : prompt,
            quietToLoud: false,
            instructOverride: true,
            responseLength: retry ? Math.max(JSON_RETRY_RESPONSE_LENGTH, Number(responseLength) || 0) : responseLength,
            trimNames: false,
        }, { ...requestScope, label: retry ? `${label} (JSON retry)` : label });
        try {
            return { parsed: parseScanJson(raw), raw, retried: retry };
        } catch (error) {
            const salvaged = salvageScannerJson(raw);
            if (salvaged) {
                console.warn(`[NPC State Delta] Problems: ${label} returned JSON with broken keys; repaired without a retry: ${salvaged.repairs.join(', ')}.`);
                return { parsed: salvaged.parsed, raw, retried: retry, repairs: salvaged.repairs };
            }
            const truncated = isTruncatedScannerJsonError(error);
            const reply = nonJsonReplyExcerpt(raw);
            if (!retry) {
                console.warn(`[NPC State Delta] ${label} returned invalid JSON; retrying once with a compact correction prompt.`, {
                    responseChars: String(raw ?? '').length,
                    truncated,
                    error: error?.message || String(error),
                    ...(reply ? { textReply: reply } : {}),
                });
                return invoke(true, truncated ? 'truncated' : 'malformed');
            }
            const wrapped = new Error(truncated
                ? `${label} JSON was truncated twice; the model did not finish its JSON response. ${error?.message || error}`
                : reply
                    ? `${label} received a text reply instead of JSON twice. The provider/model said: "${reply}" This usually means the provider blocked or refused the request, the request exceeded the model's context, or the selected connection profile is not using a chat model that follows JSON instructions.`
                    : `${label} returned malformed JSON twice; the model did not produce a valid dossier object. ${error?.message || error}`);
            wrapped.cause = error;
            throw wrapped;
        }
    };
    return invoke(false);
}
