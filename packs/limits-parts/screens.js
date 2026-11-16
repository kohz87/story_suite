// Screen field names, the tab id pattern and the mount points.

// Screens (SPEC §13.1) a pack adds or overrides by id.
// `tab` puts a screen in a shared tab (the same `tab` on several screens draws them as sections of one tab, in `order`; `tabTitle` names it, the first one
// given wins); a block's `show.into` names the same tab. `order` is the screen's place among the tabs (lower first).
export const SCREEN_FIELDS = Object.freeze(['id', 'title', 'icon', 'mounts', 'template', 'layout', 'css', 'theme', 'data', 'steps', 'tab', 'tabTitle', 'order']);
export const TAB_ID = /^[a-z][a-z0-9-]{0,39}$/;
export const TAB_TITLE_MAX = 24;
export const MOUNTS = Object.freeze(['tab', 'screen', 'card', 'hud', 'dialog']);
