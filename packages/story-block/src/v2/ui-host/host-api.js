// Story Block v2's page furniture: the api handed to screens, moved out of mountUi unchanged: commands, previews, queries, events (a `committed` handler is
// held while a form's plan runs), rewinds, dialogs, and a reply card's "open" action. `createHostApi(deps)` is given the sdk, the redraw hold and the mounts.

export function createHostApi({ sdk, redrawHold, getMounts }) {
    return Object.freeze({
        command: (type, payload, options) => sdk.command(type, payload, options),
        preview: (type, payload) => sdk.preview(type, payload),
        // A form with several steps holds the screens' redraw from `committed` until its plan ends (the returned release), then each held redraw runs once.
        hold: () => redrawHold.hold(),
        // Panels marked dirty instead of drawn (sdk.panels; inert while `suite.redrawScheduler` is off).
        panels: sdk.panels,
        // A page notice for a result the screen cannot show itself (its form was redrawn away).
        notify: text => globalThis.toastr?.warning?.(text, 'Story Block'),
        commit: token => sdk.commit(token),
        query: (name, args) => sdk.query(name, args),
        on: (name, fn) => {
            if (name !== 'committed') return sdk.on(name, fn);
            const held = (...args) => redrawHold.run(held, () => fn(...args));
            const off = sdk.on(name, held);
            return () => { redrawHold.drop(held); if (typeof off === 'function') off(); };
        },
        rewind: options => sdk.rewind(options),
        substitute: text => sdk.substitute(text),
        dialog: Object.freeze({ open: (screenId, opts) => sdk.dialog.open(screenId, opts), current: () => sdk.dialog.current?.() ?? null }),
        // A reply card's "open" action: the screen in the game view (window on desktop, full screen on a phone).
        openScreen: id => getMounts()?.screen?.open?.(id) ?? false,
    });
}
