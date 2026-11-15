/* NPC State Delta: the scanner's lines for the Settings diagnostics report. */
import { normalizeScannerMaxOutputTokens } from './shared-limits.js';
import { connectionManagerDisabled, scannerProfileOptions } from './profile-settings.js';
import { scannerRoutingMetrics } from './request-tracking.js';

// (v2 Diagnostics) The scanner's lines for Story Block's Settings → Diagnostics report: the route, the
// profile's name and whether it is there, the call counts and the last call's outcome. Never a prompt,
// a reply, a profile's address or key, or an NPC's name (a label's "for <name>" part is left out).
const yesNo = value => (value ? 'yes' : 'no');
const callKind = label => String(label || 'scanner request').replace(/\s+for\s+[\s\S]*$/i, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'scanner request';

export function scannerDiagnosticLines({ ctx = null, settings = {}, metrics = scannerRoutingMetrics(), enabled = true, now = Date.now() } = {}) {
    const lines = [];
    lines.push(`Delta on: ${yesNo(enabled)}. Auto scan: ${yesNo(settings?.autoScan)}. Full scan every turn: ${yesNo(settings?.fullScanEveryTurn)}. One-pass narration capture: ${yesNo(settings?.narrationCapture)}.`);
    const selected = typeof settings?.scannerConnectionProfile === 'string' ? settings.scannerConnectionProfile.trim() : '';
    const options = scannerProfileOptions(ctx, selected);
    const usable = options.filter(option => option.id && !option.name.startsWith('Unavailable profile ('));
    if (connectionManagerDisabled(ctx)) lines.push('Connection Profiles: turned off in SillyTavern.');
    else if (typeof ctx?.ConnectionManagerRequestService?.sendRequest !== 'function') lines.push('Connection Profiles: this SillyTavern has no Connection Manager request service.');
    else lines.push(`Connection Profiles: ${usable.length} usable for text.`);
    if (!selected) lines.push('Scanner route: the current roleplay connection.');
    else {
        const found = usable.find(option => option.id === selected);
        lines.push(found
            ? `Scanner route: the profile ${found.name.replace(/["“”]/g, '').slice(0, 80)} (id ${selected.slice(0, 80)}), available.`
            : `Scanner route: the profile id ${selected.slice(0, 80)}, which is missing or not usable for text: scans fail until another is picked (no fallback).`);
    }
    const limit = normalizeScannerMaxOutputTokens(settings?.scannerMaxOutputTokens);
    lines.push(`Scanner output limit: ${limit ? `${limit} tokens` : 'the default per pass'}.`);
    const m = metrics || {};
    lines.push(`Calls this page load: ${Number(m.total) || 0} sent (current connection ${Number(m.defaultRoute) || 0}, profile ${Number(m.profileRoute) || 0}); succeeded ${Number(m.succeeded) || 0}, failed ${Number(m.failed) || 0}, timed out ${Number(m.timedOut) || 0}, cancelled ${Number(m.cancelled) || 0}, refused before sending ${Number(m.rejected) || 0}; in flight ${Number(m.inflight) || 0}.`);
    const last = m.last;
    if (!last) lines.push('Last call: none yet.');
    else {
        const ago = Number.isFinite(last.at) ? Math.max(0, Math.round((now - last.at) / 1000)) : null;
        const seconds = Number.isFinite(last.durationMs) ? `${(last.durationMs / 1000).toFixed(1)} s` : 'unknown time';
        lines.push(`Last call: ${callKind(last.label)}, through ${last.route === 'profile' ? 'the profile' : 'the current connection'}, ${last.dispatched ? 'sent' : 'not sent'}, ${last.outcome || 'unknown'}${last.code ? ` (${String(last.code).slice(0, 60)})` : ''}, ${seconds}, asked for ${Number(last.effectiveResponseLength) || 0} tokens${ago === null ? '' : `, ${ago} s ago`}.`);
    }
    return lines;
}
