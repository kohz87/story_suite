// Story Suite v2: the `dialog` widget definition.

import { defineWidget } from '../props.js';
import { dialogProps } from './props.js';
import { renderDialog } from './render.js';

export const dialog = defineWidget({ props: dialogProps, primary: 'title', render: renderDialog });
