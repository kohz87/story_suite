// Renders the Look section: the skin, glass and text rows, with a note on what Follow SillyTavern does.
import { h } from '../../kit/dom.js';
import { sectionFrame } from './start.js';
import { renderPanelBg } from '../panel-bg.js';

/** Returns the Look page nodes for `section`; `ctx` is the overlay context. */
export function renderLookSection(section, ctx) {
  return sectionFrame(section, ctx, {
    after: [renderPanelBg({ get on() { return ctx.settings?.panelBg === true; }, set on(v) { if (ctx.settings) ctx.settings.panelBg = v; } }, ctx), h('p', { class: 'fine' }, 'Follow SillyTavern takes its colours from the theme picked in SillyTavern; the old Solid skin is gone.')],
  });
}
