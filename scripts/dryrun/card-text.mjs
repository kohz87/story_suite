// Per-reply card text for the dry-run: the "Changed this reply" card as the old view renders it (the real template over a fake DOM),
// text only. The scope is what the page host builds for that card: the reply's state and changes, the modules' card lines, and (once
// the code has it) the reply's module failures. Code without the card screen or the renderer answers null: no card field is recorded.

import { suiteAt } from './suite-at.mjs';

const squash = text => String(text ?? '').replace(/\s+/g, ' ').trim();

async function optional(load) {
  try { return await load(); } catch { return null; }
}

/** → `(host, index) => text`, or null when the checkout has no card to render (or `suite.at` is missing). */
export async function makeCardText(suite) {
  if (typeof suite?.at !== 'function') return null;
  const mods = await optional(() => Promise.all(['src/v2/screens/index.js', 'src/v2/view/screens.js', 'src/v2/view/template/index.js', 'src/v2/view/bind.js',
    'src/v2/events/index.js', 'src/v2/view/widgets/index.js', 'tests/ui-fake-dom.js'].map(rel => suiteAt(suite, rel))));
  if (!mods) return null;
  const [screens, data, template, bind, events, widgets, fakeDom] = mods;
  const screen = screens.changesCardScreen;
  const compiled = screen && template.compileTemplate(screen.template);
  if (!compiled) return null;
  const report = await optional(() => suiteAt(suite, 'src/v2/turn/apply-report.js'));

  return (host, index) => {
    const state = host.store.at(index);
    const query = (name, args) => host.sdk.query(name, { ...args, asOf: index });
    const resolved = data.resolveData(screen.data, query);
    if (!resolved.ok) throw new Error(resolved.message);
    const changes = host.store.changesAt(index);
    const moduleLines = screens.replyCardLines(host.registry?.hookEntries?.('replyCard') ?? [], { index, state, changes });
    const extra = { moduleLines };
    // The reply's module failures (J10-5): only when the code has them and the flag has put them in the Problem log.
    if (report?.moduleFailures) {
      const nameOf = id => host.registry?.modules?.().find(mod => mod?.id === id)?.name ?? id;
      extra.moduleFailed = report.moduleFailures(host.store.problems?.() ?? [], index, nameOf);
    }
    const savedDoc = globalThis.document;
    const savedCss = globalThis.CSS;
    try {
      const doc = fakeDom.installFakeDom();
      const el = doc.createElement('div');
      doc.body.appendChild(el);
      const view = template.renderTemplate(el, compiled, { state, q: resolved.q, changes, settings: {}, query, ...extra }, {
        evaluate: bind.conditionEvaluator({ compile: events.compile, evaluate: events.evaluate }),
        widgets: widgets.standardWidgets,
        command: async () => ({ ok: true }),
        onResult: () => {},
      });
      const text = squash(el.textContent);
      view?.destroy?.();
      return text;
    } finally {
      if (savedDoc === undefined) delete globalThis.document; else globalThis.document = savedDoc;
      if (savedCss === undefined) delete globalThis.CSS; else globalThis.CSS = savedCss;
    }
  };
}
