// The Inspector's screen definition: its ids, feature, template, scoped CSS and the screen data.

import { STRINGS } from '../../../../core/strings.js';
import { CORE_FEATURE } from '../../../../core/features.js';
import { BASE_CSS } from '../style.js';

const S = STRINGS.inspector;

export const INSPECTOR_SCREEN_ID = 'story-block/inspector';
export const INSPECTOR_WIDGET = 'story-block.inspector';
export const INSPECTOR_FEATURE = CORE_FEATURE.inspector;

const TEMPLATE = `
<div class="inspector">
  <ss-widget name="${INSPECTOR_WIDGET}"></ss-widget>
</div>`;

const CSS = `${BASE_CSS}
.inspector { display: grid; gap: var(--ss-space-3, 12px); }
.sb-insp { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--ss-space-3, 12px); min-width: 0; color: var(--ss-text, inherit); font-family: var(--ss-font, inherit); }
.sb-insp-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--ss-space-3, 12px); min-width: 0; }
.sb-insp-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.sb-insp-bar .sb-insp-pick { flex: 1 1 14em; min-width: 0; max-width: 100%; }
.sb-insp-bar .sb-insp-search { flex: 1 1 12em; min-width: 0; }
/* The bar's buttons are glass pills on the look's tokens. Hover and focus take the accent edge and a soft accent fill laid
   over the dense glass; the text stays the text colour (accent text on glass is hard to read). */
.sb-insp-btn { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; padding: 0 12px; box-sizing: border-box; border: 1px solid var(--ss-border, currentColor); border-radius: var(--ss-radius-pill, 999px); background: var(--ss-tile, transparent); color: var(--ss-text, inherit); font: inherit; font-weight: 600; cursor: pointer; transition: border-color var(--ss-motion, 0.2s) ease, background-color var(--ss-motion, 0.2s) ease; }
.sb-insp-btn:hover:not(:disabled), .sb-insp-btn:focus-visible:not(:disabled) { border-color: var(--ss-accent, currentColor); background: linear-gradient(var(--ss-accent-soft, transparent), var(--ss-accent-soft, transparent)), var(--ss-glass-strong, var(--ss-tile, transparent)); }
.sb-insp-btn:focus-visible { outline: 2px solid var(--ss-accent, currentColor); outline-offset: 2px; }
.sb-insp-btn:active:not(:disabled) { border-color: var(--ss-accent, currentColor); background: linear-gradient(var(--ss-accent-soft, transparent), var(--ss-accent-soft, transparent)), var(--ss-glass-strong, var(--ss-tile, transparent)); }
.sb-insp-btn:disabled { opacity: 0.45; cursor: default; }
.sb-insp-head { margin: 0; font-size: 1.1em; font-weight: 700; overflow-wrap: anywhere; }
.sb-insp-card { margin: 0; }
.sb-insp-card-title { margin: 0; }
.sb-insp-count { font-size: 0.85em; }
.sb-insp-diff, .sb-insp-ops, .sb-insp-receipts, .sb-insp-problems { margin: 0; }
.sb-insp-diff li, .sb-insp-ops li, .sb-insp-receipts li, .sb-insp-problems li { min-width: 0; }
.sb-insp-diff .ss-listcard-title, .sb-insp-ops .ss-listcard-title, .sb-insp-receipts .ss-listcard-title, .sb-insp-problems .ss-listcard-title { font-weight: 600; overflow-wrap: anywhere; }
/* Raw values (paths, state values, operations) in monospace; the words around them in the look's own font. */
.sb-insp-path, .sb-insp-ops .ss-listcard-title, .sb-insp-diff .ss-listcard-sub, .sb-insp-problems .ss-listcard-sub { font-family: var(--monoFontFamily, monospace); font-size: 0.85em; }
.sb-insp-diff .ss-listcard-title, .sb-insp-ops .ss-listcard-title { font-family: var(--monoFontFamily, monospace); font-size: 0.85em; font-weight: 600; }
.sb-insp-mark { font-weight: 700; color: var(--ss-text, inherit); }
.sb-insp-add .sb-insp-mark { background: color-mix(in srgb, var(--ss-good, #2fbf71) 22%, transparent); }
.sb-insp-remove .sb-insp-mark { background: color-mix(in srgb, var(--ss-bad, #e5484d) 22%, transparent); }
.sb-insp-change .sb-insp-mark { background: color-mix(in srgb, var(--ss-accent, currentColor) 22%, transparent); }
.sb-insp-path { color: var(--ss-text, inherit); }
.sb-insp-receipts .ss-listcard-sub, .sb-insp-meta { display: block; font-size: 0.8em; color: var(--ss-muted, inherit); }
.sb-insp-problems li .ss-listcard-title { color: var(--ss-text, inherit); }
.sb-insp-problems .ss-listcard-tag { color: var(--ss-text, inherit); }
.sb-insp-tree { font-size: 0.9em; overflow-x: auto; }
.sb-insp-tree details > .sb-insp-kids { padding-left: 1.1em; border-left: 1px dashed var(--ss-border, currentColor); margin-left: 0.3em; }
.sb-insp-tree summary, .sb-insp-tree .sb-insp-leaf { border-radius: var(--ss-radius-s, 10px); }
.sb-insp-tree summary { cursor: pointer; padding: 2px 4px; overflow-wrap: anywhere; }
.sb-insp-tree summary:hover { background: var(--ss-tile, transparent); }
.sb-insp-tree summary:focus-visible { outline: 2px solid var(--ss-accent, currentColor); outline-offset: 1px; }
.sb-insp-leaf { padding: 2px 4px 2px 1.1em; overflow-wrap: anywhere; }
.sb-insp-key { color: var(--ss-text, inherit); font-weight: 600; }
.sb-insp-str, .sb-insp-num, .sb-insp-bool, .sb-insp-null { font-family: var(--monoFontFamily, monospace); color: var(--ss-text, inherit); }
.sb-insp-num, .sb-insp-bool, .sb-insp-null { color: var(--ss-muted, inherit); }
.sb-insp-hit > summary, .sb-insp-leaf.sb-insp-hit { background: color-mix(in srgb, var(--ss-accent, currentColor) 22%, transparent); border-radius: 6px; }
.sb-insp-empty { font-style: italic; }
.sb-insp .muted { color: var(--ss-muted, var(--sb-em, inherit)); }  /* the look's muted text on the glass, not SillyTavern's emphasis colour */
`;

export const inspectorScreen = Object.freeze({
    id: INSPECTOR_SCREEN_ID,
    title: S.title,
    icon: 'fa-magnifying-glass',
    mounts: Object.freeze(['screen', 'tab']),
    order: 900,
    feature: INSPECTOR_FEATURE,
    template: TEMPLATE,
    css: CSS,
});
