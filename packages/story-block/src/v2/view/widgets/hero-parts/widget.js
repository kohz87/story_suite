// ss.hero: the hero card widget, defined from its props and its renderer.

import { defineWidget } from '../props.js';
import { heroProps } from './props.js';
import { renderHero } from './render.js';

export const hero = defineWidget({ props: heroProps, primary: 'name', render: renderHero });
