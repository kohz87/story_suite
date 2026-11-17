// Story Block's own optional pieces as features, with their preset switches.

import { CORE_FEATURE } from '../../../../../core/features.js';
import { FEATURE_TEXT } from '../../../../assist/index.js';
import { STRINGS } from '../../../../../core/strings.js';

// Story Block's own optional pieces as features (MODULES §F100): the status strip and the cards under
// replies (on), the two assist helpers (off; each makes an extra model call), the state inspector (off)
// and save points (on). None of them changes the
// static prompt part. The host reads them where the piece is drawn or run (ui-host.js, runtime.js).
// `presets` (features.js, "How much to track"): { lean?, full? } says the switch in those presets (Standard is `default`);
// `false` keeps a feature out of presets. The pieces about the screen, the helpers, the tester's tools and the RPG are
// the reader's own choice, so no preset touches them.
const OUT_OF_PRESETS = false;
const LEAN_OFF = Object.freeze({ lean: false });
const LEAN_OFF_FULL_ON = Object.freeze({ lean: false, full: true });
export const CORE_FEATURES = Object.freeze([
    Object.freeze({ id: CORE_FEATURE.hud, label: STRINGS.features.hud, describe: STRINGS.features.hudDescribe, default: true, presets: OUT_OF_PRESETS }),
    Object.freeze({ id: CORE_FEATURE.cards, label: STRINGS.features.cards, describe: STRINGS.features.cardsDescribe, default: true, presets: OUT_OF_PRESETS }),
    // The pre-roll only works with a module that keeps `? check` lines.
    Object.freeze({ id: CORE_FEATURE.preroll, label: FEATURE_TEXT.classifier.label, describe: FEATURE_TEXT.classifier.describe, default: false, presets: LEAN_OFF_FULL_ON, needs: Object.freeze({ kinds: Object.freeze(['check']), why: FEATURE_TEXT.classifier.needs }) }),
    Object.freeze({ id: CORE_FEATURE.extractor, label: FEATURE_TEXT.extractor.label, describe: FEATURE_TEXT.extractor.describe, default: false, presets: OUT_OF_PRESETS }),
    // The state inspector is for testers and pack authors (off); save points are for every reader (on).
    Object.freeze({ id: CORE_FEATURE.inspector, label: STRINGS.features.inspector, describe: STRINGS.features.inspectorDescribe, default: false, presets: OUT_OF_PRESETS }),
    Object.freeze({ id: CORE_FEATURE.savepoints, label: STRINGS.features.savepoints, describe: STRINGS.features.savepointsDescribe, default: true, presets: OUT_OF_PRESETS }),
    // Choices and Inner chatter (MODULES §F115): off; on, each adds its grammar line to the static part.
    Object.freeze({ id: CORE_FEATURE.choices, label: STRINGS.features.choices, describe: STRINGS.features.choicesDescribe, default: false, presets: LEAN_OFF_FULL_ON }),
    Object.freeze({ id: CORE_FEATURE.chatter, label: STRINGS.features.chatter, describe: STRINGS.features.chatterDescribe, default: false, presets: LEAN_OFF_FULL_ON }),
    // The weather (MODULES §F120): on; its grammar line is in the static part while it is on.
    Object.freeze({ id: CORE_FEATURE.weather, label: STRINGS.features.weather, describe: STRINGS.features.weatherDescribe, default: true, presets: LEAN_OFF }),
    // Your look (MODULES §F126): on; its grammar line is in the static part while it is on.
    Object.freeze({ id: CORE_FEATURE.you, label: STRINGS.features.you, describe: STRINGS.features.youDescribe, default: true, presets: LEAN_OFF }),
    // The mounts: on; the grammar line and the narrator's line are there only while it is on.
    Object.freeze({ id: CORE_FEATURE.mounts, label: STRINGS.features.mounts, describe: STRINGS.features.mountsDescribe, default: true, presets: LEAN_OFF }),
    Object.freeze({ id: CORE_FEATURE.leanRpg, label: STRINGS.features.leanRpg, describe: STRINGS.features.leanRpgDescribe, default: false, presets: OUT_OF_PRESETS }),
]);
