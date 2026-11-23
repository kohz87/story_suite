// The module definition for sdk.registerModule: the domain, features, kinds, commands, queries, context, hook, settings and the new-character screen.
import { initialState } from '../domain/shape.js';
import { validate } from '../domain/validate.js';
import { renderNewCharacter } from '../widget/new-character.js';
import { MODULE_ID, FEATURE, RPG_FEATURE, VERSION } from './constants.js';
import { active } from './active.js';
import { kindsOf, applyLine } from './kinds.js';
import { queriesOf } from './queries.js';
import { create } from './commands/create.js';
import { spend, skillEdit } from './commands/spend.js';
import { rest } from './commands/rest.js';
import { dice } from './commands/dice.js';
import { narratorRules } from './static-text.js';
import { tailOf } from './tail.js';
import { rollCards } from './roll-cards.js';
import { beforeGenerate } from './hooks.js';
import { SETTINGS, ownSettings } from './settings.js';

const SCREEN = 'text-rpg/new-character';
const WIDGET = 'text-rpg.new-character';
const COUNTERS = ['members/*/wounds', 'members/*/pools/mp/now', 'members/*/pools/sp/now', 'members/*/practice/*', 'members/*/xp', 'foes/groups/*/left', 'foes/groups/*/count'];
const owned = handler => Object.assign(handler, { feature: FEATURE });

/** The module definition. `sdk` answers `feature(id)` (the active rule) and runs the screen's commands. */
export function textRpgModule(sdk = null) {
    return {
        id: MODULE_ID,
        name: 'Text RPG',
        icon: 'fa-dice-d20',
        version: VERSION,
        // Numbers that move are counters: a replay after a deleted reply adds each change instead of writing the number the deleted reply left.
        domains: { textRpg: { initial: initialState, validate, counters: COUNTERS } },
        features: [{
            id: FEATURE, label: 'Text RPG', default: false, prompt: true, replaces: [RPG_FEATURE],
            describe: 'The narrator tells fights in prose; code keeps the sheet and rolls the dice. Turning it on turns the RPG off, and turning the RPG on turns it off.',
        }],
        capture: { kinds: kindsOf(sdk), apply: applyLine },
        commands: {
            'textRpg.create': owned(create), 'textRpg.spend': owned(spend), 'textRpg.skillEdit': owned(skillEdit),
            'textRpg.rest': owned(rest), 'textRpg.dice': owned(dice),
        },
        queries: queriesOf(sdk),
        cards: rollCards(),
        context: { feature: FEATURE, static: () => (active(sdk) ? narratorRules(ownSettings(sdk)) : ''), tail: tailOf, budget: 600 },
        hooks: { beforeGenerate: Object.assign(beforeGenerate, { feature: FEATURE }) },
        settings: SETTINGS,
        widgets: {
            [WIDGET]: { props: {}, feature: FEATURE, render: (el, props, api) => renderNewCharacter(el, props, { ...api, command: (type, payload) => (api?.command ?? sdk.command)(type, payload, { cause: 'ui' }) }) },
        },
        screens: [{
            id: SCREEN, title: 'New character', mounts: ['dialog'], feature: FEATURE,
            template: `<ss-widget name="${WIDGET}" data-props="{}"></ss-widget>`,
        }],
    };
}
