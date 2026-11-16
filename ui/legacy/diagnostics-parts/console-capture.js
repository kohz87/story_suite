// Catching Story Suite's console errors and page errors once per page.
import { ERRORS_KEPT } from './limits.js';
import { scrubLine } from './secrets.js';
import { caught, keep } from './shared-caught.js';
import { noteError } from './notes.js';

const FOLDERS = ['Story_block', 'story_block', 'npc_state_delta', 'Story_director', 'story_director'];

let consoleWrapped = null;
/**
 * Catches Story Suite's console errors (and page errors from its files) for the report, once per page.
 * The original console.error still runs first. → stop().
 */
export function captureConsole(target = globalThis.console, win = globalThis) {
    if (consoleWrapped || !target || typeof target.error !== 'function') return () => {};
    const original = target.error;
    const wrapped = function (...parts) {
        original.apply(this, parts);
        try { noteError(parts); } catch { /* the report is never worth an error */ }
    };
    target.error = wrapped;
    const onError = event => {
        const file = String(event?.filename ?? '');
        if (!FOLDERS.some(folder => file.includes(`/${folder}/`))) return;
        keep(caught.errors, { text: scrubLine(`[page] ${event?.message ?? 'error'} (${file.split('/').slice(-2).join('/')}:${event?.lineno ?? 0})`) }, ERRORS_KEPT);
    };
    win?.addEventListener?.('error', onError);
    consoleWrapped = () => {
        if (target.error === wrapped) target.error = original;
        win?.removeEventListener?.('error', onError);
        consoleWrapped = null;
    };
    return consoleWrapped;
}
