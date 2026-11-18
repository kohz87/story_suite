import assert from 'node:assert/strict';
import { makeState, runCommand } from './helpers/fake-ctx.js';
import { part } from '../../../../modules/world/chronicle/index.js';

export const DAY = 1440;
export const ON = { 'story-director.world-events': true };
export const PACKS = {
    conditions: [
        { name: 'grain-dear', scope: 'region', fades: '10 days', means: 'Bread costs more.' },
        { name: 'roads-closed', scope: 'route', fades: 'until cleared', means: 'Nobody passes.' },
        { name: 'unrest', scope: 'place', fades: '1 season', means: 'Crowds.' },
    ],
    places: [{ name: 'Highmark', region: 'The March', aliases: ['The Capital'] }, { name: 'Bluewatch', region: 'The March' }],
    routes: [{ from: 'Highmark', to: 'Bluewatch', kind: 'road', slug: 'highmark-bluewatch-road', corridor: '' }],
    list: [{ id: 'p', name: 'Ersveil' }],
};
export const start = (minutes = DAY) => makeState({ minutes });
export const run = (state, type, payload, options = {}) => runCommand(state, part.commands[type], payload, { cause: 'system', packs: PACKS, features: ON, ...options });
export const set = (state, payload, options) => run(state, 'chronicle.condition.set', { by: 'director', why: 'test', ...payload }, options);
export const must = result => { assert.equal(result.ok, true, result.message); return result; };
