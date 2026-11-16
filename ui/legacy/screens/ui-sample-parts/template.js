// The sample's template: one pane per colour scheme, and the screen that holds both.

import { UI_SAMPLE_ID } from './text.js';

// One pane of the sample, in one scheme. Bars and badges come both as widgets and as plain classes, so
// the page shows that a template can use either.
function pane(scheme) {
    const name = scheme === 'light' ? 'Light' : 'Dark';
    return `
<section class="ss-sample-pane ss-scheme-${scheme}" aria-label="${name}">
  <p class="ss-label ss-glass-strong ss-sample-tag">${name} · glass card, pills, bars, status badges</p>
  <div class="ss-glass">
    <div class="ss-sample-row" style="align-items: center">
      <h3 class="ss-sample-title">{{ q.pc.name }}</h3>
      <ss-widget name="ss.pill" data-props='{"text":"{{ q.pc.line }}"}'></ss-widget>
    </div>
    <div class="ss-sample-row">
      <span class="ss-pill ss-pill-soft">Soft pill</span>
      <span class="ss-pill ss-pill-outline">Outline pill</span>
      <ss-widget name="ss.pill" data-props='{"text":"With an icon","icon":"fa-cloud-rain","style":"soft"}'></ss-widget>
    </div>
    <div class="ss-sample-grid3">
      <ss-widget name="ss.bar" data-props='{"label":"HP","kind":"hp","value":{{ q.pc.hp.cur }},"max":{{ q.pc.hp.max }}}'></ss-widget>
      <ss-widget name="ss.bar" data-props='{"label":"MP","kind":"mp","value":{{ q.pc.mp.cur }},"max":{{ q.pc.mp.max }}}'></ss-widget>
      <ss-widget name="ss.bar" data-props='{"label":"SP","kind":"sp","value":{{ q.pc.sp.cur }},"max":{{ q.pc.sp.max }}}'></ss-widget>
    </div>
    <div class="ss-bar ss-bar-exp" role="meter" aria-label="Soul growth" aria-valuemin="0" aria-valuemax="{{ q.pc.exp.max }}" aria-valuenow="{{ q.pc.exp.cur }}">
      <div class="ss-bar-head" aria-hidden="true"><span class="ss-bar-label">Soul growth (classes only)</span><span class="ss-bar-value">{{ q.pc.exp.cur }} / {{ q.pc.exp.max }}</span></div>
      <div class="ss-bar-track" data-bind-var="--ss-fill: ratio(q.pc.exp.cur, q.pc.exp.max)"><div class="ss-bar-fill"></div></div>
    </div>
    <div class="ss-sample-row">
      <ss-widget data-each="q.statuses as s" name="ss.status" data-props='{"label":"{{ s.label }}","icon":"{{ s.icon }}","left":"{{ s.left }}","unit":"{{ s.unit }}","tone":"{{ s.tone }}","id":"{{ s.id }}"}'></ss-widget>
    </div>
  </div>
  <p class="ss-label ss-glass-strong ss-sample-tag">Tiles · level badge, tick, lock, chosen</p>
  <div class="ss-glass ss-sample-grid3">
    <ss-widget data-each="q.skills as k" name="ss.tile" data-props='{"label":"{{ k.label }}","icon":"{{ k.icon }}","count":"{{ k.count }}","state":"{{ k.state }}","selected":"{{ k.selected }}","tone":"{{ k.tone }}","hint":"{{ k.hint }}","id":"{{ k.id }}"}'></ss-widget>
  </div>
  <p class="ss-label ss-glass-strong ss-sample-tag">Bag tiles · count in the corner, rarity rings</p>
  <div class="ss-glass ss-sample-row">
    <ss-widget data-each="q.bag as b" name="ss.tile" data-props='{"label":"{{ b.label }}","icon":"{{ b.icon }}","count":"{{ b.count }}","countStyle":"corner","tone":"{{ b.tone }}","showLabel":false,"id":"{{ b.id }}"}'></ss-widget>
  </div>
  <div class="ss-glass-strong">
    <p class="ss-label">Strong glass</p>
    <p style="margin: 4px 0 0">Navigation and cards over busy art. <span style="color: var(--ss-muted)">Muted text for the quiet parts.</span></p>
  </div>
  <p class="ss-label ss-glass-strong ss-sample-tag">Hero · portrait, bars, corner, badges</p>
  <ss-widget name="ss.hero" data-props='{"bind":"q.hero"}'></ss-widget>
  <p class="ss-label ss-glass-strong ss-sample-tag">Hero, compact · the strip under a reply</p>
  <ss-widget name="ss.hero" data-props='{"bind":"q.heroCompact"}'></ss-widget>
  <p class="ss-label ss-glass-strong ss-sample-tag">Tiers · tiles joined by a connector</p>
  <ss-widget name="ss.tiers" data-props='{"bind":"q.tiers","onSelect":"sample.pick"}'></ss-widget>
  <p class="ss-label ss-glass-strong ss-sample-tag">List cards · value, tag, chosen row, icon</p>
  <ss-widget name="ss.listcard" data-props='{"bind":"q.ready"}'></ss-widget>
  <ss-widget name="ss.listcard" data-props='{"bind":"q.here","onSelect":"sample.pick"}'></ss-widget>
  <ss-widget name="ss.listcard" data-props='{"bind":"q.people"}'></ss-widget>
  <p class="ss-label ss-glass-strong ss-sample-tag">Map · places, a route, the reader's place, fog, legend</p>
  <ss-widget name="ss.map" data-props='{"bind":"q.map"}'></ss-widget>
  <p class="ss-label ss-glass-strong ss-sample-tag">Tabs and navbar · arrows move, Enter chooses</p>
  <ss-widget name="ss.tabs" data-props='{"bind":"q.tabs","onSelect":"sample.go"}'></ss-widget>
  <ss-widget name="ss.navbar" data-props='{"bind":"q.nav","onSelect":"sample.go"}'></ss-widget>
  <p class="ss-label ss-glass-strong ss-sample-tag">Dialog · focus trap, Escape, focus returns</p>
  <div class="ss-sample-row"><button type="button" class="menu_button ss-sample-open-dialog">Open a dialog</button></div>
  <p class="ss-label ss-glass-strong ss-sample-tag">Form engine · switch, fields, slider, chips, lines, search, groups</p>
  <div class="ss-sample-form"></div>
</section>`;
}

/** The sample screen: a template (both panes) and its data. */
export const uiSampleScreen = Object.freeze({
    id: UI_SAMPLE_ID,
    title: 'UI sample',
    icon: 'fa-swatchbook',
    mounts: Object.freeze(['dialog']),
    template: `<div class="ss-sample-panes">${pane('light')}${pane('dark')}</div>`,
});

/** The template text of one pane, for tests. */
export const uiSamplePane = pane;
