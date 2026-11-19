/* NPC State's scanner-output setting (Maximum output tokens), drawn in its settings section's Advanced group right after Scan context. */
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { npcBucket } from './bucket.js';
import {
    normalizeScannerMaxOutputTokens,
    SCANNER_MAX_OUTPUT_TOKENS_MAX,
} from '../calls/scanner-routing.js';

const SETTINGS_ID = 'people_settings';
const CONTROL_ID = 'people_scanner_max_output_tokens';
const GUARD = '__pplScannerOutputUi';

function settings() {
    return npcBucket(extension_settings, { create: true });
}

function persistSettings() {
    const ctx = getContext?.();
    if (typeof ctx?.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
}

function settingRow() {
    const row = document.createElement('label');
    row.className = 'ppl-setting-row story-suite-row delta-scanner-output-row';
    row.htmlFor = CONTROL_ID;
    row.innerHTML = `<span><b>Maximum output tokens</b><small>0 keeps Delta's built-in per-request limits. 128-${SCANNER_MAX_OUTPUT_TOKENS_MAX} sets the maximum output for every NPC scanner text call, including retries and focused passes. It does not change roleplay or image-generation limits.</small></span><span class="delta-setting-number story-suite-number"><input id="${CONTROL_ID}" type="number" min="0" max="${SCANNER_MAX_OUTPUT_TOKENS_MAX}" step="1" inputmode="numeric" class="text_pole ppl-number"><small>tokens</small></span>`;
    return row;
}

function syncControl(root) {
    const input = root?.querySelector?.(`#${CONTROL_ID}`);
    if (!input || document.activeElement === input) return;
    input.value = String(normalizeScannerMaxOutputTokens(settings().scannerMaxOutputTokens));
}

function mountControl() {
    const root = document.getElementById(SETTINGS_ID);
    const after = root?.querySelector?.('#people_scan_depth')?.closest?.('label');
    if (!after) return false;
    let input = root.querySelector(`#${CONTROL_ID}`);
    if (!input) {
        const row = settingRow();
        after.after(row);
        input = row.querySelector(`#${CONTROL_ID}`);
    }
    syncControl(root);
    if (input && !input.dataset.deltaBound) {
        input.dataset.deltaBound = '1';
        input.addEventListener('change', () => {
            const raw = Number(input.value);
            const normalized = raw > 0 ? normalizeScannerMaxOutputTokens(raw) : 0;
            settings().scannerMaxOutputTokens = normalized;
            input.value = String(normalized);
            persistSettings();
            globalThis.toastr?.success?.(normalized
                ? `NPC State: scanner maximum output set to ${normalized} tokens.`
                : 'NPC State: scanner output returned to built-in per-request limits.');
        });
    }
    return true;
}

function start() {
    if (typeof document === 'undefined') return;
    mountControl();
    if (document[GUARD]) return;
    document[GUARD] = true;
    document.addEventListener('people:settings-mounted', mountControl);
    const retryMount = (attempt = 0) => {
        if (!mountControl() && attempt < 40) setTimeout(() => retryMount(attempt + 1), 100);
    };
    retryMount();
    window.addEventListener?.('focus', () => syncControl(document.getElementById(SETTINGS_ID)));
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else queueMicrotask(start);
}
