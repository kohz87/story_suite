import { createHost } from '../../../testkit/index.js';
import { makeMessage } from '../../ui-fake-dom.js';
import { setupDom } from '../view/mounts/helpers.js';
import { mountUi } from '../../../src/v2/ui-host.js';

export const WITH_LINES = 'You find a rope.\n<Changes>\n+ item Rope | qty: 1\n- item Lantern | qty: 1\n</Changes>';
export const HUD_MODULE = {
    id: 'hud-test', name: 'HUD test', version: '0.0.1',
    screens: [{ id: 'hud-test/strip', title: 'Strip', mounts: ['hud'], template: '<b class="where">{{ state.scene.place.name }}</b>' }],
};

/** A host, a page with a message box, and the UI; `reread` (optional) becomes sdk.reread; false: none at all. */
export async function page({ reread = null, modules = [], settings = null, callModel = null } = {}) {
    const doc = setupDom();
    const form = doc.createElement('div');
    form.id = 'send_form';
    doc.body.appendChild(form);
    const drawerHost = doc.createElement('div');
    drawerHost.id = 'extensions_settings';
    doc.body.appendChild(drawerHost);
    const host = await createHost({ modules, ...(settings ? { settings } : {}), ...(callModel ? { callModel } : {}) });
    const calls = [];
    const sdk = reread === false ? { ...host.sdk, reread: undefined }
        : reread ? { ...host.sdk, reread: async index => { calls.push(index); return reread(index, host); } } : host.sdk;
    const turn = reread === false ? { ...host.turn, reread: undefined } : host.turn;
    const runtime = { registry: host.registry, store: host.store, sdk, settings: host.settings, events: host.events, turn, setGuardRefresh: host.setGuardRefresh };
    const ui = mountUi({ runtime, ctx: host.ctx, doc, version: '2.0.0-test' });
    /** SillyTavern drawing every message of the chat. */
    const draw = () => {
        for (const old of doc.querySelectorAll('.mes')) old.remove();
        host.ctx.chat.forEach((message, index) => makeMessage(doc, index));
        ui.notes.refreshAll();
    };
    const noteAt = index => doc.querySelector(`.mes[mesid="${index}"] .story-suite-reply-note`);
    return { doc, host, ui, draw, noteAt, calls };
}
