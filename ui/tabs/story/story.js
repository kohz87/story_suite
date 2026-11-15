// Composes the Story tab: a Director / Trackers switch, the plan bar and the Director cards or the Trackers view.
import { h } from '../../kit/dom.js';
import { segmented } from '../../kit/controls.js';
import { directorCards, planBar } from './director.js';
import { agendasCard } from './agendas.js';
import { secretsCard, ripplesCard } from './ripples-secrets.js';
import { trackersView } from './trackers.js';

/** Builds the Story tab from a `story` view-model; ctx = { prefs, go, command, refresh }. */
export function storyTab(story = {}, ctx = {}) {
  const shown = Boolean(story.plan?.shown);
  const prefs = ctx.prefs;
  const body = h('div', { class: 'story-body' });
  let view = prefs?.getFold?.('story.trackers', false) ? 'trackers' : 'director';

  function director() {
    const [pulse, cast, arc, beats, clocks, hooks, news] = directorCards(story, ctx);
    const grid = [pulse, cast, arc, beats, clocks, agendasCard(story.agendas, shown, ctx), hooks, news,
      secretsCard(story.secrets, shown, ctx), ripplesCard(story.ripples, shown)].filter(Boolean);
    return [
      planBar(shown, (next) => { prefs?.setSpoiler?.('plan', next); ctx.refresh?.(next); }),
      h('div', { class: 'dgrid2' }, grid),
    ];
  }

  function draw() {
    body.dataset.view = view;
    body.replaceChildren(...(view === 'trackers' ? [trackersView(story, ctx)] : director()));
  }
  draw();

  const switcher = segmented({
    items: [['director', 'Director'], ['trackers', 'Trackers']], value: view, label: 'Story view', className: 'wseg glass',
    onChange: (next) => { view = next; prefs?.setFold?.('story.trackers', next === 'trackers'); draw(); },
  });
  return h('div', { class: 'story-tab', dataset: { tab: 'story' } }, switcher, body);
}
