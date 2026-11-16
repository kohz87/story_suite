// The UI sample (a developer's page, Settings → Diagnostics → Show the UI sample): every building block of
// Story Suite's look (view/glass-*.css, view/widgets/: tile, bar, status, pill, hero, tiers, listcard, tabs, navbar, dialog) in light and in dark side by side, over
// SillyTavern's own background, for checking a theme and for screenshots. It is not a screen of the
// game view or a tab: it opens only from that button, shows made-up sample data, and changes nothing.
//
// It is drawn the way every screen is: an HTML template through SillyTavern's DOMPurify and the template
// allow-list (createScreenRenderer), the standard widgets by name. Each pane forces its scheme with the
// class `ss-scheme-light` or `ss-scheme-dark` (view/theme.js); with the "Follow SillyTavern only" panel style both panes show the
// theme as it is.
// Public face: re-exports its parts.

export { UI_SAMPLE_ID, UI_SAMPLE_TEXT } from './ui-sample-parts/text.js';
export { UI_SAMPLE_FORM, mountDemoForm } from './ui-sample-parts/form.js';
export { UI_SAMPLE_DATA } from './ui-sample-parts/data.js';
export { uiSampleScreen, uiSamplePane } from './ui-sample-parts/template.js';
export { openUiSample } from './ui-sample-parts/open.js';
