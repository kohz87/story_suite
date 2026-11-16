// The Assist page's schema and the places its switches live.

import { SETTING, SCHEMA } from '../../../../../modules/assist/common.js';
import { KIND_CHOICES, allowedKinds } from '../../../../../modules/assist/safety.js';
import { CORE_FEATURE } from '../../../../../core/features.js';
import { HOST_SETTINGS_SCHEMA } from '../../../../../core/sdk.js';
import { ASSIST_TEXT } from './text.js';

const ids = Object.freeze({ preroll: CORE_FEATURE.preroll, net: CORE_FEATURE.extractor });

/**
 * The page's schema and the places its switches live. `featureOf(id)` is the feature store's entry now (label, describe,
 * available, why, on), `on(id)` whether it is on. → { schema, sources }. The order is the page's: Extra calls, Checks, Safety net.
 */
export function assistSchema({ featureOf, on, hostSettings, features }) {
    const feature = id => featureOf(id) ?? null;
    const usable = id => Boolean(feature(id)) && feature(id).available !== false;
    const switchFor = (id, label, group) => ({
        type: 'bool', group, label, help: feature(id)?.describe ?? '',
        readOnly: () => !features || !usable(id),
        lockText: () => (!features ? ASSIST_TEXT.noFeatures : feature(id)?.why || ASSIST_TEXT.noFeatures),
    });
    const calls = ASSIST_TEXT.callsTitle;
    const schema = {
        [SETTING.profile]: {
            ...SCHEMA[SETTING.profile], group: calls, label: ASSIST_TEXT.profile,
            readOnly: () => !on(ids.preroll) && !on(ids.net), lockText: ASSIST_TEXT.bothOff,
        },
        callQueue: { ...HOST_SETTINGS_SCHEMA.callQueue, group: calls },
        [ids.preroll]: switchFor(ids.preroll, ASSIST_TEXT.preroll, ASSIST_TEXT.checksTitle),
        [ids.net]: switchFor(ids.net, ASSIST_TEXT.net, ASSIST_TEXT.netTitle),
        [SETTING.extractorProfile]: {
            ...SCHEMA[SETTING.extractorProfile], group: ASSIST_TEXT.netTitle, label: ASSIST_TEXT.netProfile,
            readOnly: () => !on(ids.net), lockText: ASSIST_TEXT.netOff,
        },
        [SETTING.extractorKinds]: {
            type: 'text', form: 'chips', group: ASSIST_TEXT.netTitle, label: ASSIST_TEXT.kinds, help: ASSIST_TEXT.kindsHelp,
            options: KIND_CHOICES, read: text => [...allowedKinds(text)],
            readOnly: () => !on(ids.net), lockText: ASSIST_TEXT.netOff,
        },
    };
    const sources = {
        callQueue: { get: () => hostSettings().callQueue === true, set: value => hostSettings.set(null, 'callQueue', value) },
    };
    for (const id of Object.values(ids)) {
        sources[id] = {
            get: () => on(id) && usable(id),
            set: value => (features && usable(id) ? features.set(id, value) : undefined),
        };
    }
    return { schema, sources };
}
