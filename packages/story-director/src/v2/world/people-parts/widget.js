// Story Director v2, people widget: the widget definition (props, validation, render) and its default instance.

import { FEATURE } from '../known.js';
import { dossierOpener, castApi } from './delta-api.js';
import { render } from './draw.js';

export const PEOPLE_WIDGET = 'story-director.people';

/**
 * The widget; `open` (tests): () → a function opening one dossier by name, or null; `cast` (tests): () →
 * NPC State Delta's page API, or null.
 */
export function createPeopleWidget({ open = dossierOpener, cast = castApi } = {}) {
    return Object.freeze({
        props: Object.freeze({ value: Object.freeze({ type: 'object', default: null }) }),
        primary: 'value',
        feature: FEATURE,
        validate: props => (props?.value !== undefined && props.value !== null && typeof props.value !== 'object' ? ['value must be the director.world.here data.'] : []),
        render: (el, props, api) => render(el, props, api, { open, cast }),
    });
}

export const peopleWidget = createPeopleWidget();
