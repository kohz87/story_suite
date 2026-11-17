// Builds the Tools page: what is sent, Inspector and Problems (with the rebuild entry), Diagnostics and the developer cards. Reads the live engine each time it draws.
import { renderSent } from './sent.js';
import { renderProblems } from './problems.js';
import { renderDiagnostics } from './diagnostics.js';
import { renderDeveloper } from './developer.js';
import { openInspector } from './inspector.js';
import { renderSavePoints } from './savepoints.js';

/**
 * Creates the page body builder. `settings` = the view-model, `ctx` = the overlay's { onAction, view(name, args), doc, backStack, repaint },
 * `developer` = { on, own } for the Developer cards. Returns `() => nodes`. The sent card, problems and the Inspector come from `ctx.view` (live); with none, from the snapshot.
 */
export function createToolsPage(settings, ctx, developer) {
  const local = { force: false, confirming: false, rebuilding: null, error: '', note: '', naming: false, busy: false, spNote: '' };
  const redraw = () => ctx.repaint?.();
  const ask = (key, value) => Promise.resolve(ctx.onAction?.(key, value));

  function start(module, read) {
    Object.assign(local, { confirming: false, rebuilding: { module, read }, error: '' });
    redraw();
    ask('tools.rebuild', { module, read }).then(answer => { local.error = answer?.ok === false ? String(answer.message ?? 'It did not start.') : ''; }, error => { local.error = String(error?.message ?? error); })
      .finally(() => { local.rebuilding = null; redraw(); });
  }

  // A save point's answer: its words on the card (a failure says why); the card is drawn again from the live list.
  function savePoint(key, value, failed, done = '') {
    Object.assign(local, { busy: true, spNote: '' });
    redraw();
    ask(key, value).then(answer => { local.spNote = answer?.ok === false ? `${failed}: ${answer.message ?? '?'}` : (answer?.warning ?? done); if (answer?.ok !== false) local.naming = false; },
      error => { local.spNote = `${failed}: ${error?.message ?? error}`; }).finally(() => { local.busy = false; redraw(); });
  }

  function copy() {
    ask('tools.report').then(async answer => {
      if (answer?.ok === false) { local.note = String(answer.message ?? 'The report could not be made.'); return; }
      const clip = (ctx.doc?.defaultView ?? globalThis).navigator?.clipboard;
      try { await clip.writeText(answer.text); local.note = 'Copied. Paste it into your bug report.'; } catch { local.note = 'Your browser did not allow copying.'; }
    }, error => { local.note = String(error?.message ?? error); }).finally(redraw);
  }

  return function body() {
    const fresh = ctx.view?.('sent');
    const sent = fresh ? { ...fresh, limits: settings.sent?.limits ?? [] } : settings.sent;
    const problems = ctx.view?.('problems') ?? { items: [], rebuild: null };
    const open = { Inspector: () => openInspector(ctx), Problems: () => { local.force = true; redraw(); } };
    const rb = problems.rebuild;
    const points = renderSavePoints(ctx.view?.('savepoints') ?? null, {
      naming: local.naming, busy: local.busy, note: local.spNote,
      setNaming: on => { local.naming = on; local.spNote = ''; redraw(); },
      make: name => savePoint('tools.savepoint.make', { name }, 'The save point could not be made', 'Saved.'),
      back: id => savePoint('tools.savepoint.return', { id }, 'Could not return'),
      forget: id => savePoint('tools.savepoint.forget', { id }, 'Could not forget it'),
    });
    const state = { ...local, setConfirm: on => { local.confirming = on; redraw(); }, start: read => start(rb.module, read) };
    return [
      ...(sent?.budget ? renderSent(sent, sent.limits ?? [], ctx, open) : []),
      renderProblems(problems, state),
      points,
      renderDiagnostics({ note: local.note, copy }),
      ...renderDeveloper({ on: developer.on() }, developer.own),
    ].filter(Boolean);
  };
}
