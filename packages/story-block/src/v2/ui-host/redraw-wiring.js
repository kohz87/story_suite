// The page's one redraw scheduler for the old UI, used only while the flag `suite.redrawScheduler` is on.
// Two sections, both read from an epoch that every event which redraws today bumps: `panel` (register the tabs, redraw the open
// tab host) and `overlay-size` (the overlay's prompt size). A burst of events is one frame that draws the newest state.

import { createRedraw } from '../shared/redraw.js';

/**
 * `wireRedraw({ on, mounts, getPanel, getTabHost, getOverlay, schedule? })` → { on(), mark(), flushNow(), hold(), register(id, section), changed(keys), destroy() }.
 * `on()` is the flag, read at every call; the scheduler is built at the first call that needs it. `hold()` gives a release function
 * (a no-op while the flag is off). `flushNow({ guard })` draws at once even while a hold is open (a chat switch must not show the old chat); `guard: false` skips the field guard.
 */
export function wireRedraw({ on, mounts, getPanel, getTabHost, getOverlay, schedule }) {
    // (a draw that throws is logged, then thrown on: the scheduler keeps its own failed list)
    const logged = (name, fn) => () => { try { return fn(); } catch (error) { console.warn(`[Story Suite] the ${name} redraw failed`, error); throw error; } };
    let scheduler = null;
    let epoch = 0;
    let guarded = true;   // a chat switch draws the new chat's pane even with a field focused (the field is gone with the old chat)
    const own = () => {
        if (scheduler) return scheduler;
        scheduler = createRedraw(schedule ? { schedule } : {});
        scheduler.register('panel', {
            isVisible: () => !getPanel().hidden,
            read: () => ({ epoch, tab: getTabHost()?.active?.() ?? null }),
            draw: logged('panel', () => { mounts.tab.register(); getTabHost()?.refresh({ guard: guarded }); }),
        });
        scheduler.register('overlay-size', {
            isVisible: () => true,
            read: () => ({ epoch }),
            draw: logged('overlay size', () => getOverlay()?.refreshSize?.()),
        });
        return scheduler;
    };
    return {
        on: () => on() === true,
        /** Something that redraws today happened: the next frame draws the newest state. */
        mark() {
            epoch += 1;
            // (a hidden panel still has its tabs registered at once, as the old path did; it is drawn when it opens)
            if (getPanel().hidden) mounts.tab.register();
            own().markDirty();
        },
        flushNow({ guard = true } = {}) {
            const sched = own();
            guarded = guard !== false;
            try { return sched.flushNow(); } finally { guarded = true; }
        },
        hold() { return on() === true ? own().hold() : () => {}; },
        /** What sdk.panels needs of the scheduler (bound by mountUi): modules' sections are registered into it, and `changed(keys)` marks them. */
        register: (id, section) => own().register(id, section),
        changed: keys => own().changed(keys),
        destroy() { scheduler?.destroy(); scheduler = null; },
    };
}
