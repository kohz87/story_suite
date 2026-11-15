// The module definition: the domain, commands, queries, context and the Fishing tab and widget.
import { renderFishing } from '../widget.js';
import { MODULE_ID, VERSION } from './constants.js';
import { initial, validate } from './validate.js';
import { cast } from './cast.js';
import { reel, release } from './reel.js';
import { waitingOf } from './shared-session.js';
import { sliceOf, copy, openLine } from './shared-slice.js';
import { WIDGET_PROPS, widgetProps, fishingProps } from './widget-props.js';

/** The module definition for sdk.registerModule. `sdk` is only used by the tab, for commands. */
export function fishingModule(sdk = null) {
    return {
        id: MODULE_ID,
        name: 'Fishing',
        version: VERSION,
        domains: { fishing: { initial, validate } },
        commands: { 'fishing.cast': cast, 'fishing.reel': reel, 'fishing.release': release },
        queries: {
            'fishing.log': state => copy(sliceOf(state).log),
            'fishing.session': state => openLine(sliceOf(state)),
            // meta.rev as the transaction sees it: the cast's startedRev (ctx has no rev of its own).
            'fishing.rev': state => (Number.isInteger(state?.meta?.rev) ? state.meta.rev : null),
        },
        context: {
            static: () => '',
            tail: view => {
                const open = waitingOf(sliceOf(view?.state));
                return { lines: [], optional: open ? [`Fishing: a line is in the water at ${open.spot.name}.`] : [] };
            },
            budget: 20,
        },
        // The mini-game as a widget (SPEC §13.5), for any layout; the tab is that widget on its own.
        widgets: {
            fishing: {
                props: WIDGET_PROPS,
                render: (el, props, api) => renderFishing(el, widgetProps(props, api, sdk), widgetApi(null, api, sdk)),
            },
        },
        tabs: [{
            id: 'fishing',
            title: 'Fishing',
            icon: 'fa-fish',
            render: (el, view, api) => renderFishing(el, fishingProps(view, sdk), widgetApi(view, api, sdk)),
        }],
    };
}

// Commands for the widget: the tab api's when the host gives one, else the sdk's (cause 'ui').
function widgetApi(view, api, sdk) {
    return {
        ...api,
        command: api?.command
            ? (type, payload) => api.command(type, payload, { cause: 'ui' })
            : (type, payload) => sdk.command(type, payload, { cause: 'ui' }),
        query: (name, args) => (view?.query ?? sdk?.query)?.(name, args) ?? null,
    };
}
