// Pack events, the part: wires the engine, the fire command, the status queries and the Diagnostics fold into one Story Block part.

import { FIRE, createEngine, createFireEvent } from '../engine.js';
import { EVENTS_NOTE, renderEventsSection } from '../section.js';
import { stateHash } from '../../../../core/timeline/host-block.js';
import { packEvents } from './pack-events.js';

const sdk = () => globalThis.StoryBlock?.sdk ?? null;

export function createEventsPart({
    events = packEvents,
    command = (type, payload, options) => {
        const host = sdk();
        if (!host) return { ok: false, code: 'FAILED', message: 'Story Block is not ready.' };
        return host.command(type, payload, options);
    },
    query = (name, args) => {
        const host = sdk();
        if (!host) throw new Error('Story Block is not ready.');
        return host.query(name, args);
    },
} = {}) {
    const engine = createEngine({ events, command, query });
    // A query is called (state, args, tools) with tools.query over the same state (MODULES §F.3);
    // without tools it asks through the injected query.
    const status = (state, args, tools) => engine.status(state, typeof tools?.query === 'function' ? { state, query: tools.query } : null);
    return {
        domains: {},
        commands: { [FIRE]: createFireEvent(events) },
        queries: { 'events.status': status, 'events.replayState': state => ({ hash: stateHash(state), claims: state?.meta?.claims ?? {} }) },
        kinds: {},
        hooks: { beforeGenerate: (view, info) => engine.beforeGenerate(view, info) },
        settings: {
            section: 'Events',
            // Debug information that tells what is coming (every pack event, its condition, its time): a fold
            // in Settings → Diagnostics, folded, not among the settings (SPEC §6 `place`).
            place: 'diagnostics',
            fold: { id: 'events', hint: 'every pack event' },
            defaults: {},
            schema: {},
            // The custom debug panel (SPEC §6 `section(el, api)`), under a one-line note that it can spoil
            // the story; `api.query` when the host offers it.
            render: (el, api) => {
                const doc = el.ownerDocument ?? globalThis.document;
                const note = doc.createElement('p');
                note.className = 'story-suite-muted ss-events-note';
                note.textContent = EVENTS_NOTE;
                const body = doc.createElement('div');
                el.textContent = '';
                el.appendChild(note);
                el.appendChild(body);
                return renderEventsSection(body, () => {
                    if (typeof api?.query === 'function') return api.query('events.status');
                    const host = sdk();
                    return typeof host?.query === 'function' ? host.query('events.status') : status(null);
                });
            },
        },
        tabs: [],
    };
}

export const part = createEventsPart();
