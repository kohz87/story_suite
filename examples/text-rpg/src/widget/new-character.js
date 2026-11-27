// The "New character" screen as a widget: a copy of the RPG's New character wizard (src/wizard), Who · Stats · Skills · Review, 60 points over seven stats (5 to 15 each) and up to five skills.
//
//   props: {} (none)   api: { command(type, payload) → Promise<result>, close() }
//
// It only collects what the reader chose and sends `textRpg.create`; the command checks it all again. The sheet is the plug-in screen's own.
import { mountWizard } from '../wizard/wizard.js';

export function renderNewCharacter(el, props = {}, api = {}) {
    return mountWizard(el, api);
}
