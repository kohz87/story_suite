// A module's own report section: its hook's answer as safe lines, and the wait limit on the hook.
import { scrubLine } from './secrets.js';
import { scrubSettings } from './scrub-settings.js';
import { textOf } from './shared-caught.js';

// A module's own section, from what its hook gave: text, a list of lines, or an object (key: value lines).
export function hookLines(value) {
    if (value === null || value === undefined) return [];
    if (typeof value === 'string') return value.split(/\r?\n/).map(line => scrubLine(line)).filter(Boolean).slice(0, 60);
    if (Array.isArray(value)) return value.slice(0, 60).map(line => scrubLine(typeof line === 'string' ? line : textOf(line)));
    if (typeof value === 'object') {
        const lines = Array.isArray(value.lines) ? hookLines(value.lines) : [];
        const data = value.lines !== undefined ? value.data : value;
        if (data && typeof data === 'object') {
            const removed = [];
            const clean = scrubSettings(data, removed);
            for (const [key, inner] of Object.entries(clean)) lines.push(scrubLine(`${key}: ${typeof inner === 'string' ? inner : JSON.stringify(inner)}`, 400));
            if (removed.length) lines.push(`(left out: ${removed.join(', ')})`);
        }
        return lines;
    }
    return [scrubLine(String(value))];
}

export function withLimit(run, ms) {
    return new Promise(resolve => {
        let done = false;
        const timer = setTimeout(() => { if (!done) { done = true; resolve({ late: true }); } }, ms);
        Promise.resolve().then(run).then(value => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({ value });
        }, error => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({ error });
        });
    });
}
