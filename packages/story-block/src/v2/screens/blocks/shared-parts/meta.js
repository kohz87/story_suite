// The words under a block's name on the Blocks page.
import { fill } from '../../../strings.js';
import { P, S } from './words.js';
import { plural } from './format.js';

export function metaOf(definition, managed, rpgOn = true) {
    if (managed) return (rpgOn ? P.rpgShown : P.rpgIdle)[definition.role];
    const buttons = Object.values(definition.kinds ?? {}).filter(kind => kind.ui).length, rules = definition.rules?.length ?? 0, timers = definition.timers?.length ?? 0;
    const show = definition.show, shown = [];
    if (show?.tab) shown.push(fill(P.whereTab, { name: show.tabName, icon: String(S.icons[show.icon] ?? '').toLowerCase() || show.icon }));
    if (show?.card) shown.push(P.whereCard);
    return [plural(Object.keys(definition.state ?? {}).length, P.fields), buttons ? plural(buttons, P.buttons) : '', rules ? plural(rules, P.rules) : '',
        timers ? plural(timers, P.timers) : '', shown.join(', ') || P.whereHidden].filter(Boolean).join(' · ');
}
