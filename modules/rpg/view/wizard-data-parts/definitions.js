// The block definitions Create makes: the extras, and the Character and Skills blocks (Combat Rules v1's, or the earlier rules' for a Re-read of a join in a chat made under them).

import { uniqueBlockSlug } from '../../../data-modules/block-builder.js';
import { buildStandardDefinitions } from './definitions-standard.js';
import { buildV1Definitions } from './definitions-v1.js';
import { blockNames } from './block-names.js';
import { template, standardTemplate } from './shared-template.js';

export { blockNames };

/** The stock definitions for some of the extras (`roles`), their slugs free among `used` (the ids of the story's blocks and of the ones made with them). */
export function extraDefinitions(roles, { used = [], rules = 'v1' } = {}) {
    const taken = [...used];
    return roles.map(role => {
        const definition = rules === 'standard' ? standardTemplate(role) : template(role);
        definition.slug = uniqueBlockSlug(definition.name, taken);
        taken.push(definition.slug);
        return definition;
    });
}

/**
 * The two definitions Create makes, from the templates with the wizard's values written as the fields' defaults. `used` is the ids of the blocks the chat has, so the slugs are free;
 * `points` sets the Character's unspent points (a companion who joins starts with none, the wizard's the budget left); `cap` is the story's level cap (rules.js levelCapFor, 99 unset).
 * Always Combat Rules v1's blocks, except where `rules: 'standard'` (or one of the earlier path's options, `legacy`, `scale: 1` or `typed: false`) says the chat already holds the earlier ones: a
 * Re-read of a join there builds them again. → { character, skills } (definitions, the Character first)
 */
export function buildDefinitions(draft, { rules = 'v1', ...options } = {}) {
    const earlier = rules === 'standard' || options.legacy === true || options.scale === 1 || options.typed === false;
    return earlier ? buildStandardDefinitions(draft, options) : buildV1Definitions(draft, options);
}
