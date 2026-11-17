// The block definitions Create makes: the extras, and the Character and Skills blocks (Combat Rules v1's).

import { uniqueBlockSlug } from '../../../data-modules/block-builder.js';
import { buildV1Definitions } from './definitions-v1.js';
import { blockNames } from './block-names.js';
import { template } from './shared-template.js';

export { blockNames };

/** The stock definitions for some of the extras (`roles`), their slugs free among `used` (the ids of the story's blocks and of the ones made with them). */
export function extraDefinitions(roles, { used = [] } = {}) {
    const taken = [...used];
    return roles.map(role => {
        const definition = template(role);
        definition.slug = uniqueBlockSlug(definition.name, taken);
        taken.push(definition.slug);
        return definition;
    });
}

/**
 * The two definitions Create makes, from the templates with the wizard's values written as the fields' defaults. `used` is the ids of the blocks the chat has, so the slugs are free;
 * `points` sets the Character's unspent points (a companion who joins starts with none, the wizard's the budget left); `cap` is the story's level cap (rules.js levelCapFor, 99 unset).
 * → { character, skills } (definitions, the Character first)
 */
export const buildDefinitions = (draft, options = {}) => buildV1Definitions(draft, options);
