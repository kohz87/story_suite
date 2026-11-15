// Story Director v2, names: the part object: its feature, domain, commands, query, kind, hooks and settings.

import { DEFAULT_SUGGESTIONS, MAX_SUGGESTIONS } from './limits.js';
import { FEATURE, namesOn } from './feature.js';
import { initialNames, validateNames } from './validate.js';
import { applyPerson } from './apply.js';
import { seeSeen, told } from './steps.js';
import { profileOf } from './scene.js';
import { beforeGenerate } from './before-generate.js';
import { tail } from './tail.js';

const GRAMMAR = '+ person Name | look: … | flaw: … | voice: … | temper: … (once, when a named person first appears: a new name, never the player, a known or pack person)';

export const part = {
    features: [{ id: FEATURE, label: 'Names', describe: 'Checks the name of a person who first appears (banned, overused and already-used names), offers unused names from the pack, and remembers a one-line profile for minor people.', default: true }],
    domains: { names: { initial: initialNames, validate: validateNames } },
    commands: { 'names.seen': Object.assign(seeSeen, { feature: FEATURE }), 'names.told': Object.assign(told, { feature: FEATURE }) },
    queries: { 'names.profile': Object.assign((state, args = {}, tools) => (namesOn(tools) ? profileOf(state?.domains?.names, args?.name) : null), { feature: FEATURE }) },
    kinds: { person: { grammar: GRAMMAR, apply: applyPerson, feature: FEATURE } },
    context: { static: () => '', tail },
    hooks: { beforeGenerate: Object.assign(beforeGenerate, { feature: FEATURE }) },
    settings: {
        section: 'Names',
        defaults: { banned: '', suggestions: DEFAULT_SUGGESTIONS },
        schema: {
            banned: { type: 'text', label: 'Banned names', multiline: true, max: 2000, feature: FEATURE, help: 'One name per line (or comma): a first name stops a new person from taking it.' },
            suggestions: { type: 'int', label: 'Name suggestions', min: 0, max: MAX_SUGGESTIONS, feature: FEATURE, help: 'Unused names from the pack offered to the narrator for new people each reply (0 turns it off).' },
        },
    },
    tabs: [],
};
