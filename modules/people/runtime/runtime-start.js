/* NPC State v1.18.0 bootstrap. */
import { prepareNpcStateHardening } from '../core/hardening.js';

/** Starts the People part: the hardening, the scanner routing, the saved calendar, the runtime and its settings, then the page tools (editor refinements, the data and portrait dialogs, the settings section's extra controls), in this order (index.js awaits it after every module). */
export async function startPeople() {
    await prepareNpcStateHardening();
    await import('../calls/scanner-routing.js');
    await import('../settings/calendar-settings.js');
    await import('./runtime-entry.js');
    try {
        await import('../core/destructive-settlement.js');
    } catch (error) {
        console.error('[NPC State] destructive history settlement failed to load', error);
    }
    try {
        await import('../tools/settings-actions.js');
    } catch (error) {
        console.error('[NPC State] supporting tools UI failed to load', error);
    }
    try {
        await import('../tools/editor-refine.js');
    } catch (error) {
        console.error('[NPC State] NPC editor refinements failed to load', error);
    }
    try {
        await import('../tools/continuity-ui.js');
    } catch (error) {
        console.error('[NPC State] continuity UI failed to load', error);
    }
    try {
        await import('../tools/editor-desk.js');
    } catch (error) {
        console.error('[NPC State] desktop editor layout failed to load', error);
    }
    try {
        await import('../settings/scanner-output.js');
    } catch (error) {
        console.error('[NPC State] scanner output/UI refinement failed to load', error);
    }
}
