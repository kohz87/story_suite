// The registry of the standard widgets, keyed by their namespaced names (`ss.<name>`).

import { badge } from '../badge.js';
import { bar, pill, status, tile } from '../glass.js';
import { dialog } from '../dialog.js';
import { editable } from '../editable.js';
import { hero } from '../hero.js';
import { listcard } from '../listcard.js';
import { navbar, tabs } from '../nav.js';
import { tiers } from '../tiers.js';
import { map } from '../map.js';
import { meter } from '../meter.js';
import { portrait } from '../portrait.js';
import { radar } from '../radar.js';
import { skillTree } from '../skill-tree.js';
import { stepper } from '../stepper.js';
import { timeline } from '../timeline.js';

export const standardWidgets = Object.freeze({
    'ss.meter': meter,
    'ss.radar': radar,
    'ss.map': map,
    'ss.skill-tree': skillTree,
    'ss.portrait': portrait,
    'ss.badge': badge,
    'ss.timeline': timeline,
    'ss.stepper': stepper,
    // Story Suite's look (view/glass-*.css, the UI stage).
    'ss.tile': tile,
    'ss.bar': bar,
    'ss.status': status,
    'ss.pill': pill,
    // The blocks built from them (UI stage 1b).
    'ss.hero': hero,
    'ss.tiers': tiers,
    'ss.listcard': listcard,
    'ss.tabs': tabs,
    'ss.navbar': navbar,
    'ss.dialog': dialog,
    'ss.editable': editable,
});
