// Story Director v2, part screens: behind the scenes on the Director screen, widget
// `story-director.behind` (bound to `director.behind`).
//
// The Director screen has no Reveal step: its cards are the widget `story-director.plan` (below, bound to `director.plan`), which
// shows the plan whole: Beats, the hooks the story is planning (with Next), Off-screen, Secrets and Problems, each a short card with
// its first few rows and "+N more" that opens it (no inner scroll box). The widget above is the older lock, kept for older layouts.
//
// Hidden (reveal.js: the setting on and this chat not revealed): a count and Reveal, and nothing of the
// agendas, planned beats, clocks or secrets is put into the page. Revealed: a Hide bar, then each kind
// as the Director screen draws the others (open threads, the closed ones folded), secrets by name only,
// and the problems about them. With the setting off it is shown as part of the screen, with no bar.
// Public face: re-exports its parts.

export { BEHIND_WIDGET, createBehindWidget, behindWidget } from './behind-parts/behind-widget.js';
export { PLAN_WIDGET, planWidget } from './behind-parts/plan-widget.js';
export { RIPPLES_WIDGET, createRipplesWidget, ripplesWidget } from './behind-parts/ripples-widget.js';
