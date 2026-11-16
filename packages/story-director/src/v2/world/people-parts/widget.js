// Story Director v2, people widget: the widget definition (props, validation, render) and its default instance.

import { FEATURE } from '../known.js';
import { dossierOpener, castApi } from './delta-api.js';
import { render } from './draw.js';
import { createOwnCast } from '../people-own.js';
import { LIVE_HOST } from '../../module/shared.js';

const OWN_FLAG = 'suite.worldPeopleOwn';

export const PEOPLE_WIDGET = 'story-director.people';

/**
 * The widget; `open` (tests): () → a function opening one dossier by name, or null; `cast` (tests): () →
 * NPC State Delta's page API, or null.
 */
export function createPeopleWidget({ open = dossierOpener, cast = castApi, flag = () => LIVE_HOST.flag(OWN_FLAG) } = {}) {
    return Object.freeze({
        props: Object.freeze({ value: Object.freeze({ type: 'object', default: null }) }),
        primary: 'value',
        feature: FEATURE,
        validate: props => (props?.value !== undefined && props.value !== null && typeof props.value !== 'object' ? ['value must be the director.world.here data.'] : []),
        // Flag `suite.worldPeopleOwn` (read at each render): the cards are drawn from NPC State's queries instead of its page API.
        render: (el, props, api) => {
            let own = false;
            try { own = flag() === true; } catch { own = false; }
            const page = own ? createOwnCast(api, { open, signal: cast }) : null;
            return render(el, props, api, { open, cast: page ? () => page : cast });
        },
    });
}

export const peopleWidget = createPeopleWidget();
